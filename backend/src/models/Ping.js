const mongoose = require("mongoose");

const pingSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  isSunday: { type: Boolean, default: false },
  isOfficeHours: { type: Boolean, default: false },
  billable: { type: Boolean, default: false },
  placeName: { type: String },
  deviceName: { type: String },
  deviceId: { type: String },
  batteryOptimizationStatus: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model("Ping", pingSchema);
