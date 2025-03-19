const express = require("express");
const { loginUser, addUser } = require("../controllers/authController");

const router = express.Router();

router.post("/login", loginUser);
router.post("/adduser", addUser);

module.exports = router;
