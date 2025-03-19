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
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    const subjects = await parseExcelFile(file.path);
    const existingSubjects = await Subject.find();
    const newSubjects = subjects.filter((subject) => {
      const existingSubject = existingSubjects.find(
        (existingSubject) => existingSubject.code === subject.code
      );
      return !existingSubject;
    });
    await Subject.insertMany(newSubjects);
    res.status(201).json({ message: "Subjects created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error creating subjects", error });
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
