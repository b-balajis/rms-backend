const express = require("express");
const router = express.Router();

const {
  createDepartmentDetails,
  getDepartmentsList,
  updateDepartmentDetails,
  deleteDepartmentDetails,
} = require("../controllers/departmentController");

router.post("/create-department", createDepartmentDetails);
router.get("/get-departments-list", getDepartmentsList);
router.put("/update-department", updateDepartmentDetails);
router.delete("/delete-department", deleteDepartmentDetails);

const {
  createSubject,
  createSubjects,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
} = require("../controllers/subjectsController");

router.post("/create-subject", createSubject);
router.post("/create-subjects", createSubjects);
router.get("/get-all-subjects", getAllSubjects);
router.get("/get-subject-by-id/:id", getSubjectById);
router.put("/update-subject/:id", updateSubject);
router.delete("/delete-subject", deleteSubject);

module.exports = router;
