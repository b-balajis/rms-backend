const Student = require("../models/studentModel");
const xlsx = require("xlsx");
const { Department } = require("../models/departmentModel");
const Subject = require("../models/subjectsModel");

const collegeOfficialMail = "@becbapatla.ac.in";

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    if (["A", "-", "NQ"].includes(value.trim().toUpperCase())) return 0;
    const num = Number(value);
    return !isNaN(num) ? num : 0;
  }
  return 0;
};

const convertGpaToPercentage = (gpa) => {
  if (!gpa || isNaN(gpa)) return 0;
  return Math.round(gpa * 9.5 * 100) / 100;
};

// Create Student Records for Semester 1
const createStudentRecords = async (req, res) => {
  try {
    let noOfRecordsSaved = 0;
    const file = req.file;
    const { semester, regulation, type } = req.body;

    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let missedEntries = [];
    let duplicateEntries = [];

    // Fetch all required data in bulk
    const [departments, subjects, existingStudents] = await Promise.all([
      Department.find().lean(),
      Subject.find({
        academicRegulation: regulation.toUpperCase(),
        semester: semester,
      }).lean(),
      Student.find({}, { rollNumber: 1 }).lean(),
    ]);

    const existingRollNumbers = new Set(
      existingStudents.map((s) => s.rollNumber)
    );

    const getDeptSubjAndBatch = (regNo) => {
      let batch = regNo.startsWith("Y")
        ? "20" + regNo.substring(1, 3)
        : regNo.startsWith("L")
        ? "20" +
          (parseInt(regNo.substring(1, 3)) - 1).toString().padStart(2, "0")
        : "Invalid Registration Number";

      const match = regNo.match(/A([A-Z]{2})/);
      if (!match)
        return {
          departmentName: "Unknown Department",
          subjectsInDepartment: [],
          batch,
        };

      const deptCode = match[1];
      const department = departments.find((dept) => dept.code === deptCode);
      return {
        departmentName: department ? department.name : "Unknown Department",
        subjectsInDepartment: subjects.filter(
          (subject) => subject.departmentCode === deptCode
        ),
        batch,
      };
    };

    const students = [];

    for (const row of data) {
      const rollNumber = row["regdno"];
      const name = row["name"];
      const totalCredits = parseNumber(row["tc"]);
      let activeBacklogs = 0;

      if (!rollNumber || !name || totalCredits === 0) {
        missedEntries.push({
          regdno: rollNumber || "N/A",
          name: name || "N/A",
          reason: "Invalid data in CSV",
        });
        continue;
      }

      if (existingRollNumbers.has(rollNumber)) {
        duplicateEntries.push(rollNumber);
        continue;
      }

      const { subjectsInDepartment, departmentName, batch } =
        getDeptSubjAndBatch(rollNumber);

      const subjectsData = subjectsInDepartment.map((subject, i) => {
        const gradePoints = parseNumber(row[`gp${i + 1}`]);
        if (gradePoints === 0) activeBacklogs += 1;

        return {
          subjectName: subject.name,
          subjectCode: subject.code,
          externalMarks: parseNumber(row[`e${i + 1}`]),
          internalMarks: parseNumber(row[`i${i + 1}`]),
          totalMarks: parseNumber(row[`t${i + 1}`]),
          credits: parseNumber(row[`cr${i + 1}`]),
          gradePoints,
        };
      });

      students.push({
        rollNumber: rollNumber.toUpperCase(),
        name,
        email: `${rollNumber.toUpperCase()}${collegeOfficialMail}`,
        department: departmentName,
        batch,
        type: rollNumber.charAt(0) === "L" ? "Lateral" : "Regular",
        semesters: [
          {
            semester,
            subjects: subjectsData,
            totalCredits,
            totalGrade: parseNumber(row["tg"]),
            sgpa: parseNumber(row["sgpa"]),
            activeBacklogs,
            totalBacklogs: activeBacklogs,
          },
        ],
        cgpa: parseNumber(row["sgpa"]).toFixed(2),
        percentage: convertGpaToPercentage(parseNumber(row["sgpa"])),
        allActiveBacklogs: activeBacklogs,
        allBacklogs: activeBacklogs,
      });

      existingRollNumbers.add(rollNumber); // Add to Set to avoid duplicate processing
      noOfRecordsSaved += 1;
    }

    if (students.length > 0) {
      await Student.insertMany(students); // Bulk insert
    }

    if (noOfRecordsSaved > 0 && duplicateEntries.length === 0) {
      return res.status(201).json({
        message: "Student Records created successfully",
        noOfRecordsSaved,
      });
    } else if (noOfRecordsSaved > 0 && duplicateEntries.length > 0) {
      return res.status(207).json({
        message: "Some duplicates skipped",
        noOfRecordsSaved,
        duplicateEntries,
      });
    } else if (noOfRecordsSaved === 0 && duplicateEntries.length > 0) {
      return res
        .status(409)
        .json({ message: "No new records inserted", duplicateEntries });
    } else {
      return res.status(400).json({ message: "Invalid data in uploaded file" });
    }
  } catch (error) {
    console.error("Error while processing file upload:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// Update existing student records
const updateStudentRecords = async (req, res) => {
  try {
    let noOfRecordsUpdated = 0;
    let noOfLateralRecordsCreated = 0; // Track new lateral records
    const file = req.file;
    const { semester, regulation } = req.body;
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let missedEntries = [];
    let updatedEntries = [];
    let skippedEntries = [];

    // Fetch all required data in bulk
    const [departments, subjects, existingStudents] = await Promise.all([
      Department.find().lean(),
      Subject.find({
        academicRegulation: regulation.toUpperCase(),
        semester: semester,
      }).lean(),
      Student.find({}, { rollNumber: 1 }).lean(),
    ]);

    // **Batch fetch student records**
    const rollNumbers = data.map((row) => row["regdno"]).filter(Boolean);
    const studentMap = new Map(
      (await Student.find({ rollNumber: { $in: rollNumbers } })).map((stu) => [
        stu.rollNumber,
        stu,
      ])
    );

    let bulkUpdates = [];

    const getDeptSubjAndBatch = (regNo) => {
      let batch = regNo.startsWith("Y")
        ? "20" + regNo.substring(1, 3)
        : regNo.startsWith("L")
        ? "20" +
          (parseInt(regNo.substring(1, 3)) - 1).toString().padStart(2, "0")
        : "Invalid Registration Number";

      const match = regNo.match(/A([A-Z]{2})/);
      if (!match)
        return {
          departmentName: "Unknown Department",
          subjectsInDepartment: [],
          batch,
        };

      const deptCode = match[1];
      const department = departments.find((dept) => dept.code === deptCode);
      return {
        departmentName: department ? department.name : "Unknown Department",
        subjectsInDepartment: subjects.filter(
          (subject) => subject.departmentCode === deptCode
        ),
        batch,
      };
    };

    for (const row of data) {
      const rollNumber = row["regdno"];
      const totalCredits = parseNumber(row["tc"]);
      let activeBacklogs = 0;

      if (!rollNumber || totalCredits === 0) {
        missedEntries.push({
          regdno: rollNumber || "N/A",
          reason: "Invalid or missing data in the CSV file",
        });
        continue;
      }

      let student = studentMap.get(rollNumber);

      // **If the student is Lateral and has no records, create one for Sem-3**
      if (!student && rollNumber.startsWith("L") && semester === "3") {
        student = await Student.create({
          rollNumber: rollNumber.toUpperCase(),
          name: row["name"],
          email: `${rollNumber.toUpperCase()}${collegeOfficialMail}`,
          department: "Unknown", // Update this with actual department logic
          batch:
            "20" +
            (parseInt(rollNumber.substring(1, 3)) - 1)
              .toString()
              .padStart(2, "0"),
          type: "Lateral",
          semesters: [],
          cgpa: 0,
          percentage: 0,
          allActiveBacklogs: 0,
          allBacklogs: 0,
        });

        studentMap.set(rollNumber, student);
        noOfLateralRecordsCreated += 1;
      }

      if (!student) {
        missedEntries.push({
          regdno: rollNumber,
          reason: "Student record not found",
        });
        continue;
      }

      // **Check if semester data already exists**
      const existingSemester = student.semesters.find(
        (sem) => sem.semester === semester
      );
      if (existingSemester) {
        skippedEntries.push({
          regdno: rollNumber,
          reason: `Semester ${semester} data already exists`,
        });
        continue;
      }

      const { subjectsInDepartment, departmentName, batch } =
        getDeptSubjAndBatch(rollNumber);

      const subjectsData = subjectsInDepartment.map((subject, i) => {
        const gradePoints = parseNumber(row[`gp${i + 1}`]);
        if (gradePoints === 0) activeBacklogs += 1;

        return {
          subjectName: subject.name,
          subjectCode: subject.code,
          externalMarks: parseNumber(row[`e${i + 1}`]),
          internalMarks: parseNumber(row[`i${i + 1}`]),
          totalMarks: parseNumber(row[`t${i + 1}`]),
          credits: parseNumber(row[`cr${i + 1}`]),
          gradePoints: gradePoints,
        };
      });

      // **Update student record in memory**
      student.semesters.push({
        semester,
        subjects: subjectsData,
        totalCredits,
        totalGrade: parseNumber(row["tg"]),
        sgpa: parseNumber(row["sgpa"]),
        activeBacklogs,
        totalBacklogs: activeBacklogs,
      });

      student.allActiveBacklogs = student.semesters.reduce(
        (sum, sem) => sum + sem.activeBacklogs,
        0
      );
      student.allBacklogs = student.semesters.reduce(
        (sum, sem) => sum + sem.totalBacklogs,
        0
      );

      const totalSGPA = student.semesters.reduce(
        (sum, sem) => sum + parseNumber(sem.sgpa),
        0
      );

      student.cgpa =
        student.semesters.length > 0
          ? Number((totalSGPA / student.semesters.length).toFixed(2))
          : 0;

      student.percentage = convertGpaToPercentage(student.cgpa);

      // **Prepare bulk update operation**
      bulkUpdates.push({
        updateOne: {
          filter: { rollNumber: student.rollNumber },
          update: {
            $set: {
              semesters: student.semesters,
              allActiveBacklogs: student.allActiveBacklogs,
              allBacklogs: student.allBacklogs,
              cgpa: student.cgpa,
              percentage: student.percentage,
            },
          },
        },
      });

      updatedEntries.push(rollNumber);
      noOfRecordsUpdated += 1;
    }

    // **Perform bulk update to reduce database writes**
    if (bulkUpdates.length > 0) {
      await Student.bulkWrite(bulkUpdates);
    }

    return res.status(207).json({
      message: "Student records updated successfully",
      noOfRecordsUpdated,
      noOfLateralRecordsCreated,
      missedEntries,
      skippedEntries,
    });
  } catch (error) {
    console.error("Error while updating student records:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const updateSupplyMarks = async (req, res) => {
  try {
    let noOfRecordsUpdated = 0;
    const file = req.file;
    const { semester } = req.body;
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let missedEntries = [];
    let updatedEntries = [];

    const parseNumber = (value) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        if (["A", "-", "NQ"].includes(value.trim().toUpperCase())) return 0;
        const num = Number(value);
        return !isNaN(num) ? num : 0;
      }
      return 0;
    };

    // **Batch fetch student records**
    const rollNumbers = data.map((row) => row["regdno"]).filter(Boolean);
    const studentMap = new Map(
      (await Student.find({ rollNumber: { $in: rollNumbers } }).lean()).map(
        (stu) => [stu.rollNumber, stu]
      )
    );

    let bulkUpdates = [];

    for (const row of data) {
      const rollNumber = row["regdno"];
      const subjectCode = row["subjectCode"].trim();
      const newExternalMarks = parseNumber(row["newExternal"]);
      const newInternalMarks = parseNumber(row["newInternal"]);
      const newTotalMarks = parseNumber(row["newTotal"]);
      const newGradePoints = parseNumber(row["newGradePoints"]);

      if (!rollNumber || !subjectCode) {
        missedEntries.push({
          regdno: rollNumber || "N/A",
          subjectCode: subjectCode || "N/A",
          reason: "Missing roll number or subject code",
        });
        continue;
      }

      const student = studentMap.get(rollNumber);
      if (!student) {
        missedEntries.push({
          regdno: rollNumber,
          subjectCode,
          reason: "Student record not found",
        });
        continue;
      }

      const semesterData = student.semesters.find(
        (sem) => sem.semester === semester
      );
      if (!semesterData) {
        missedEntries.push({
          regdno: rollNumber,
          subjectCode,
          reason: `Semester ${semester} not found for student`,
        });
        continue;
      }

      const subjectEntry = semesterData.subjects.find(
        (sub) => sub.subjectCode.trim() === subjectCode
      );
      if (!subjectEntry) {
        missedEntries.push({
          regdno: rollNumber,
          subjectCode,
          reason: "Subject not found in student record",
        });
        continue;
      }

      // **Update marks**
      subjectEntry.externalMarks = newExternalMarks;
      subjectEntry.internalMarks = newInternalMarks;
      subjectEntry.totalMarks = newTotalMarks;
      subjectEntry.gradePoints = newGradePoints;

      // **Recalculate SGPA for the semester**
      const totalCredits = semesterData.subjects.reduce(
        (sum, sub) => sum + (sub.credits || 0),
        0
      );
      const weightedGradePoints = semesterData.subjects.reduce(
        (sum, sub) =>
          sum + (sub.gradePoints > 0 ? sub.credits * sub.gradePoints : 0),
        0
      );

      semesterData.totalGrade = semesterData.subjects.reduce(
        (sum, sub) => sum + (sub.gradePoints || 0),
        0
      );

      semesterData.sgpa =
        totalCredits > 0
          ? Number((weightedGradePoints / totalCredits).toFixed(2))
          : 0;

      // **Recalculate Active & Total Backlogs**
      semesterData.activeBacklogs = semesterData.subjects.filter(
        (sub) => sub.gradePoints === 0
      ).length;
      semesterData.totalBacklogs = semesterData.activeBacklogs;

      student.allActiveBacklogs = student.semesters.reduce(
        (sum, sem) => sum + sem.activeBacklogs,
        0
      );
      student.allBacklogs = student.semesters.reduce(
        (sum, sem) => sum + sem.totalBacklogs,
        0
      );

      // **Recalculate CGPA and Percentage**
      const totalSGPA = student.semesters.reduce(
        (sum, sem) => sum + parseNumber(sem.sgpa),
        0
      );

      student.cgpa =
        student.semesters.length > 0
          ? Number((totalSGPA / student.semesters.length).toFixed(2))
          : 0;

      student.percentage = Math.round((student.cgpa - 0.5) * 10 * 100) / 100;

      // **Prepare bulk update**
      bulkUpdates.push({
        updateOne: {
          filter: { rollNumber: student.rollNumber },
          update: {
            $set: {
              semesters: student.semesters,
              allActiveBacklogs: student.allActiveBacklogs,
              allBacklogs: student.allBacklogs,
              cgpa: student.cgpa,
              percentage: student.percentage,
            },
          },
        },
      });

      updatedEntries.push({ regdno: rollNumber, subjectCode });
      noOfRecordsUpdated += 1;
    }

    // **Perform bulk update**
    if (bulkUpdates.length > 0) {
      await Student.bulkWrite(bulkUpdates);
    }

    return res.status(207).json({
      message: "Supply marks update process completed",
      noOfRecordsUpdated,
      missedEntries,
      updatedEntries,
    });
  } catch (error) {
    console.error("Error while updating supply marks:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const addStudent = async (req, res) => {
  try {
    const { name, rollNumber, studentId, department, semester, cgpa } =
      req.body;

    if (!studentId) {
      return res.status(400).json({ error: "studentId is required" });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({ rollNumber });
    if (existingStudent) {
      return res
        .status(400)
        .json({ error: "Student with this roll number already exists" });
    }

    // Create student with auto-calculated percentage
    const student = new Student({
      name,
      rollNumber,
      department,
      semester,
      cgpa,
    });
    await student.save();

    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const { batch } = req.query;
    const students = await Student.find({ batch });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// send student details based on dept and batch
const getStudentDetails = async (req, res) => {
  try {
    const { department, batch } = req.query;

    if (!department || !batch) {
      return res
        .status(400)
        .json({ error: "department and batch are required" });
    }
    const students = await Student.find({ department, batch });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeDuplicateSemesters = async (req, res) => {
  try {
    const { semester } = req.body; // Semester to clean up

    if (!semester) {
      return res.status(400).json({ error: "Semester is required" });
    }

    // Fetch students who have multiple entries for the same semester
    const students = await Student.find({ "semesters.semester": semester });

    const bulkUpdates = [];

    students.forEach((student) => {
      // Filter out duplicate semesters, keeping only one instance
      const filteredSemesters = [];
      const seenSemesters = new Set();

      student.semesters.forEach((sem) => {
        if (sem.semester === semester) {
          if (!seenSemesters.has(semester)) {
            seenSemesters.add(semester);
            filteredSemesters.push(sem); // Keep only the first occurrence
          }
        } else {
          filteredSemesters.push(sem); // Keep other semesters as they are
        }
      });

      // If changes are needed, add them to the bulk update
      if (filteredSemesters.length !== student.semesters.length) {
        bulkUpdates.push({
          updateOne: {
            filter: { rollNumber: student.rollNumber },
            update: { $set: { semesters: filteredSemesters } },
          },
        });
      }
    });

    // Perform bulk update
    if (bulkUpdates.length > 0) {
      await Student.bulkWrite(bulkUpdates);
    }

    res.json({
      message: `Duplicate entries for semester ${semester} removed successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addStudent,
  getStudents,
  createStudentRecords,
  updateStudentRecords,
  updateSupplyMarks,
  getStudentDetails,
};
