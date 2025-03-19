const Student = require("../models/studentModel");
const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Department = require("../models/departmentModel");
const Subject = require("../models/subjectsModel");

// Configure Multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

const createStudentRecords = async (req, res) => {
  try {
    const file = req.file;
    const { semester, regulation, batch, type } = req.body;
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const parseNumber = (value) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        if (["A", "-", "NQ"].includes(value.trim().toUpperCase())) return 0;
        const num = Number(value);
        return !isNaN(num) ? num : 0;
      }
      return 0;
    };

    const departments = await Department.find().lean();
    const subjects = await Subject.find({
      academicRegulation: regulation,
    }).lean();

    const getDepartment = (code) => {
      const match = code.match(/A([A-Z]{2})/);
      if (!match)
        return {
          departmentName: "Unknown Department",
          subjectsInDepartment: [],
        };

      const deptCode = match[1];
      const department = departments.find((dept) => dept.code === deptCode);
      const subjectsInDepartment = subjects.filter(
        (subject) => subject.departmentCode === deptCode
      );

      return {
        departmentName: department ? department.name : "Unknown Department",
        subjectsInDepartment,
      };
    };

    const convertGpaToPercentage = (gpa) => {
      if (!gpa || isNaN(gpa)) return 0;
      return Math.round((gpa - 0.5) * 10 * 100) / 100;
    };

    let missedEntries = []; // Track invalid records

    const students = data
      .map((row, index) => {
        const rollNumber = row["regdno"];
        const name = row["name"];
        const totalCredits = parseNumber(row["tc"]);

        if (!rollNumber || !name || totalCredits === 0) {
          missedEntries.push({
            regdno: rollNumber || "N/A",
            name: name || "N/A",
          });
          return null;
        }

        const { subjectsInDepartment, departmentName } =
          getDepartment(rollNumber);
        const subjects = subjectsInDepartment.map((subject, i) => ({
          subjectName: subject.name,
          subjectCode: subject.code,
          externalMarks: parseNumber(row[`e${i + 1}`]),
          internalMarks: parseNumber(row[`i${i + 1}`]),
          totalMarks: parseNumber(row[`t${i + 1}`]),
          credits: parseNumber(row[`cr${i + 1}`]),
          gradePoints: parseNumber(row[`gp${i + 1}`]),
        }));

        return {
          rollNumber,
          name,
          department: departmentName,
          batch,
          type,
          semesters: [
            {
              semester,
              subjects,
              totalCredits,
              totalGrade: parseNumber(row["tg"]),
              sgpa: parseNumber(row["sgpa"]),
            },
          ],
          cgpa: parseNumber(row["sgpa"]).toFixed(2),
          percentage: convertGpaToPercentage(parseNumber(row["sgpa"])),
        };
      })
      .filter((student) => student !== null); // Remove invalid records

    if (students.length > 0) {
      await Student.insertMany(students);
    }

    res.json({
      message: "Students created and uploaded successfully",
      missedEntries, // Return the missed entries list
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error creating and uploading students data",
      error: error.message,
    });
  }
};

const updateStudentRecords = async (req, res) => {
  try {
    const file = req.file;
    const { semester } = req.body;
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Fetch all students in one go to avoid multiple DB queries
    const studentRollNumbers = data.map((row) => row.regdno);
    const students = await Student.find({
      rollNumber: { $in: studentRollNumbers },
    });

    // Convert student data into a map for quick access
    const studentMap = new Map(students.map((s) => [s.rollNumber, s]));

    const bulkUpdates = [];

    for (const row of data) {
      const { regdno, tc, tg, sgpa, ...marks } = row;
      const student = studentMap.get(regdno);

      if (!student) {
        console.log(`Student not found: ${regdno}`);
        continue;
      }

      const subjects = [];
      for (let i = 1; i <= 9; i++) {
        if (marks[`e${i}`] !== undefined) {
          subjects.push({
            externalMarks: isNaN(marks[`e${i}`])
              ? null
              : Number(marks[`e${i}`]),
            internalMarks: isNaN(marks[`i${i}`])
              ? null
              : Number(marks[`i${i}`]),
            totalMarks: isNaN(marks[`t${i}`]) ? null : Number(marks[`t${i}`]),
            credits: isNaN(marks[`cr${i}`]) ? 0 : Number(marks[`cr${i}`]),
            gradePoints: isNaN(marks[`gp${i}`]) ? 0 : Number(marks[`gp${i}`]),
          });
        }
      }

      // Prepare semester data
      const newSemester = {
        semester,
        subjects,
        totalCredits: isNaN(tc) ? 0 : Number(tc),
        totalGrade: isNaN(tg) ? 0 : Number(tg),
        sgpa: isNaN(sgpa) ? 0 : Number(sgpa),
      };

      // Calculate new CGPA
      const allSemesters = [...student.semesters, newSemester];
      const totalGrades = allSemesters.reduce(
        (sum, sem) => sum + sem.totalGrade,
        0
      );
      const totalCredits = allSemesters.reduce(
        (sum, sem) => sum + sem.totalCredits,
        0
      );
      const newCGPA =
        totalCredits > 0 ? (totalGrades / totalCredits).toFixed(2) : 0;
      const newPercentage = (newCGPA * 9.5).toFixed(2);

      // Add bulk update operation
      bulkUpdates.push({
        updateOne: {
          filter: { rollNumber: regdno },
          update: {
            $push: { semesters: newSemester },
            $set: { cgpa: newCGPA, percentage: newPercentage },
          },
        },
      });
    }

    // Perform bulk update
    if (bulkUpdates.length > 0) {
      await Student.bulkWrite(bulkUpdates);
    }

    res.json({ message: "Next semester results uploaded successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
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
  getStudentDetails,
};
