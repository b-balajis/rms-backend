const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  semester: { type: Number, required: true },
  subjects: [
    {
      name: String,
      gradePoint: Number,
    },
  ],
  sgpa: { type: Number, required: true },
});

module.exports = mongoose.model("Result", resultSchema);
