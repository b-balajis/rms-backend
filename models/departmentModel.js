const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  description: { type: String, required: true, unique: true },
});

const subjectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    credits: { type: Number, required: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    }, // Reference to Department

    academicRegulation: { type: String, required: true }, // e.g., "R18", "R22" (regulation versions)
  },
  { timestamps: true }
);

// Faculty Model
const facultySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    designation: { type: String, required: true },
    department: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const FacultyModel = mongoose.model("Faculty", facultySchema);

const Department = mongoose.model("Department", departmentSchema);

module.exports = { Department, FacultyModel };
