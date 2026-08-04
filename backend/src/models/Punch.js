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
  billable: { type: Boolean, default: false },
  placeName: { type: String }, // human-readable address from reverse geocoding

  // New fields:
  punchCategory: { type: String, enum: ["personal", "project"], default: "project" },
  workType: { type: String, enum: ["site_work", "office_work", "meeting", "tour", null], default: null },
  transportMode: { type: String, enum: ["personal_vehicle", "public_transport", "office_vehicle"] },
  photoType: { type: String, enum: ["start", "end"] },
  photoBase64: { type: String }, // captured photo, stored as base64 data URL
  deviceName: { type: String },  // e.g. "Samsung Galaxy M31"
  deviceId: { type: String },    // Android ID (not true IMEI - Android blocks that since Android 10)
  odometerReading: { type: Number },
  ticketAmount: { type: Number },
  ticketDate: { type: Date },
  ocrResult: {
    text: { type: String, default: null },
    confidence: { type: Number, default: null },
    filename: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
}, { timestamps: true });

module.exports = mongoose.model("Punch", punchSchema);
