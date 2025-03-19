const Result = require("../models/resultModel");

// Get results for a student
const getResultsByStudent = async (req, res) => {
  try {
    const results = await Result.find({ studentId: req.params.studentId });
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add student result
const addResult = async (req, res) => {
  try {
    const { studentId, semester, subjects, sgpa } = req.body;
    const result = new Result({ studentId, semester, subjects, sgpa });
    await result.save();
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { getResultsByStudent, addResult };
