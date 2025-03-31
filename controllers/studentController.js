const Student = require("../models/studentModel");
const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Department = require("../models/departmentModel");
const Subject = require("../models/subjectsModel");

const getStudentDetails = async (req, res) => {
  try {
    const rollNumber = req.params.rollNumber;
    const student = await Student.find({ rollNumber });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: "Error fetching student details" });
  }
};

module.exports = {
  getStudentDetails,
};
