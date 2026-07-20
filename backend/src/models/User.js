const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["employee", "manager"], default: "employee" },
  officeStartTime: { type: String, default: "09:30" },
  officeEndTime: { type: String, default: "18:30" },
  ratePerKm: { type: Number, default: 0 },
  active: { type: Boolean, default: true }, // manager toggle: if false, employee cannot punch/ping at all
  lastLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date,
    placeName: String,
  },
  lastDevice: {
    deviceName: String,
    deviceId: String,
    timestamp: Date,
  },

  // Auto-tracking schedule (set by manager) - lets background tracking run
  // on a fixed weekly schedule instead of only between manual Punch In/Out.
  autoSchedule: {
    enabled: { type: Boolean, default: false },
    days: { type: [String], default: [] }, // e.g. ["monday","tuesday","wednesday"]
    startTime: { type: String, default: "08:00" }, // "HH:MM" 24hr
    endTime: { type: String, default: "20:00" },
    intervalMinutes: { type: Number, default: 30 }, // background ping interval
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
