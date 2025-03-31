const express = require("express");
const multer = require("multer");
const router = express.Router();

const { getStudentDetails } = require("../controllers/studentController");

router.get("/get-student-details/:rollNumber", getStudentDetails);

module.exports = router;
