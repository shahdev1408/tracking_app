const mongoose = require("mongoose");

// One document per 30-min background location ping
const pingSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  isSunday: { type: Boolean, default: false },
  isOfficeHours: { type: Boolean, default: false },
  billable: { type: Boolean, default: false },
  placeName: { type: String }, // human-readable address from reverse geocoding
}, { timestamps: true });

module.exports = mongoose.model("Ping", pingSchema);
