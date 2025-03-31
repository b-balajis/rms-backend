const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  subjectName: { type: String, required: true },
  subjectCode: { type: String, required: true },
  externalMarks: { type: Number },
  internalMarks: { type: Number },
  totalMarks: { type: Number },
  credits: { type: Number },
  gradePoints: { type: Number },
});

const semesterSchema = new mongoose.Schema(
  {
    semester: { type: String, required: true },
    subjects: { type: [subjectSchema], required: true },
    totalCredits: { type: Number, required: true },
    totalGrade: { type: Number, required: true },
    sgpa: { type: String, required: true },
    activeBacklogs: {
      type: Number,
      default: 0,
      required: true,
    },
    totalBacklogs: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  { timestamps: true }
);

const studentSchema = new mongoose.Schema(
  {
    rollNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    department: { type: String, required: true },
    batch: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, required: true, default: "Active" },
    semesters: { type: [semesterSchema], default: [] },
    allActiveBacklogs: {
      type: Number,
      default: 0,
      required: true,
    },
    allBacklogs: {
      type: Number,
      default: 0,
      required: true,
    },
    cgpa: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "students" }
);

module.exports = mongoose.model("Student", studentSchema);
