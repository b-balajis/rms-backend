const express = require("express");
const multer = require("multer");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const {
  createDepartmentDetails,
  getDepartmentsList,
  updateDepartmentDetails,
  deleteDepartmentDetails,
  getAllFacultyDetails,
  createFacultyProfile,
} = require("../controllers/departmentController");

router.post("/create-department", createDepartmentDetails);
router.get("/get-departments-list", getDepartmentsList);
router.put("/update-department", updateDepartmentDetails);
router.delete("/delete-department", deleteDepartmentDetails);

router.get("/get-all-faculty-details", getAllFacultyDetails);
router.post("/create-faculty-profile", createFacultyProfile);

const {
  createSubject,
  createSubjects,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
} = require("../controllers/subjectsController");

router.post("/create-subject", createSubject);
router.post("/upload/create-subjects", upload.single("file"), createSubjects);
router.get("/get-all-subjects", getAllSubjects);
router.get("/get-subject-by-id/:id", getSubjectById);
router.put("/update-subject/:id", updateSubject);
router.delete("/delete-subject", deleteSubject);

module.exports = router;
