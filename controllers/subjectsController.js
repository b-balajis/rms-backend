const Subject = require("../models/subjectsModel");

// Create a Subject
const createSubject = async (req, res) => {
  try {
    const {
      code,
      name,
      credits,
      department,
      academicRegulation,
      departmentCode,
      semester,
    } = req.body;
    const existingSubject = await Subject.findOne({ code });
    if (existingSubject)
      return res.status(400).json({ message: "Subject code already exists" });

    const subject = new Subject({
      code,
      name,
      credits,
      department,
      academicRegulation,
      departmentCode,
      semester,
    });
    await subject.save();
    res.status(201).json(subject);
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Error creating subject", error });
  }
};

// Create subjects in bulk by using excel file
const createSubjects = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let insertedCount = 0;
    let updatedCount = 0;
    let errors = [];

    const bulkOps = [];

    for (const row of data) {
      const {
        code,
        name,
        credits,
        department,
        departmentCode,
        academicRegulation,
        semester,
      } = row;

      if (
        !code ||
        !name ||
        !credits ||
        !department ||
        !departmentCode ||
        !academicRegulation ||
        !semester
      ) {
        errors.push({ code: code || "N/A", reason: "Missing required fields" });
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { code },
          update: {
            $set: {
              name,
              credits,
              department,
              departmentCode,
              academicRegulation,
              semester,
            },
          },
          upsert: true, // Create if not exists
        },
      });
    }

    if (bulkOps.length > 0) {
      const result = await Subject.bulkWrite(bulkOps);
      insertedCount = result.upsertedCount || 0;
      updatedCount = result.modifiedCount || 0;
    }

    res.status(200).json({
      message: "Subjects uploaded successfully",
      insertedCount,
      updatedCount,
      errors,
    });
  } catch (error) {
    console.error("Error uploading subjects:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// Get all Subjects
const getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().populate("department", "name");
    res.status(200).json(subjects);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subjects", error });
  }
};

// Get Subject by ID
const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate(
      "department",
      "name"
    );
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.status(200).json(subject);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subject", error });
  }
};

// Update a Subject
const updateSubject = async (req, res) => {
  try {
    const { name, credits, department, academicRegulation } = req.body;
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { name, credits, department, academicRegulation },
      { new: true, runValidators: true }
    );
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.status(200).json(subject);
  } catch (error) {
    res.status(500).json({ message: "Error updating subject", error });
  }
};

// Delete a Subject
const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.status(200).json({ message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting subject", error });
  }
};

module.exports = {
  createSubject,
  createSubjects,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
};
