const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    credits: { type: Number, required: true },
    department: {
      type: String,
      required: true,
    },
    departmentCode: {
      type: String,
      required: true,
    },
    academicRegulation: { type: String, required: true }, // e.g., "R18", "R22" (regulation versions)
  },
  { timestamps: true }
);
const Subject = mongoose.model("Subject", subjectSchema);

module.exports = Subject;
