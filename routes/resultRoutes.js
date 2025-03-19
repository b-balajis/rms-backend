const express = require("express");
const {
  getResultsByStudent,
  addResult,
} = require("../controllers/resultController");
const router = express.Router();

router.get("/:studentId", getResultsByStudent);
router.post("/", addResult);

module.exports = router;
