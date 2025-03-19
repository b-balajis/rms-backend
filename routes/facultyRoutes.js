const express = require("express");
const multer = require("multer");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });
const {
  getStudents,
  addStudent,
  createStudentRecords,
  updateStudentRecords,
  getStudentDetails,
} = require("../controllers/facultyController");

router.get("/get-all-students", getStudents);
router.get("/get-student-details", getStudentDetails);

router.post("/", addStudent);
router.post(
  "/upload/create-records",
  upload.single("file"),
  createStudentRecords
);

router.patch(
  "/upload/update-records",
  upload.single("file"),
  updateStudentRecords
);

module.exports = router;
