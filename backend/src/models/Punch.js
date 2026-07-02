const mongoose = require("mongoose");

const punchSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, index: true },
  type: { type: String, enum: ["in", "out"], required: true },
  site: { type: String },
  location: { type: String },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  isSunday: { type: Boolean, default: false },
  isOfficeHours: { type: Boolean, default: false },
  billable: { type: Boolean, default: false }, // computed from rules
}, { timestamps: true });

module.exports = mongoose.model("Punch", punchSchema);
