const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
  officeStartTime: { type: String, default: "09:30" }, // "HH:MM"
  officeEndTime: { type: String, default: "18:30" },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Employee", employeeSchema);
