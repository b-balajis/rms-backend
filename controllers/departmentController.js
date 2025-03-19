const Department = require("../models/departmentModel");

const createDepartmentDetails = async (req, res) => {
  try {
    const { name, code, description } = req.body;

    const department = await Department.create({
      name,
      code,
      description,
    });

    res.status(201).json({ message: "Department created successfully" });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Error in creating department details" });
  }
};

const getDepartmentsList = async (req, res) => {
  try {
    const departments = await Department.find();
    res.status(200).json(departments);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error in fetching departments list" });
  }
};

const updateDepartmentDetails = async (req, res) => {
  try {
    const { id } = req.query;
    const { code, description, name } = req.body;
    console.log(id);

    const department = await Department.findByIdAndUpdate(id, {
      code,
      description,
      name,
    });
    res
      .status(200)
      .json({ message: "Department updated successfully", department });
  } catch (error) {
    console.log(error, "49");
    res.status(500).json({ message: "Error in updating department details" });
  }
};

const deleteDepartmentDetails = async (req, res) => {
  try {
    const { id } = req.query;
    await Department.destroy({
      where: { id: id },
    });
    res.status(200).json({ message: "Department deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error in deleting department details" });
  }
};

module.exports = {
  createDepartmentDetails,
  getDepartmentsList,
  updateDepartmentDetails,
  deleteDepartmentDetails,
};
