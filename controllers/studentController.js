const Student = require("../models/studentModel");
const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Department = require("../models/departmentModel");
const Subject = require("../models/subjectsModel");

// Configure Multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = {};
