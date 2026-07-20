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

  // Fixed anchor points set by manager (editable). Used so the leg from
  // "leaving home/base" to the first punch of the day, and the leg from
  // the last punch back to base in the evening, both count toward km/pay -
  // not just the distance between auto-track pings.
  startPoint: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  endPoint: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },

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
    // How often to ping while inside the scheduled window. Note: Android
    // enforces a hard minimum of ~15 min between background wake-ups, so
    // values below 15 can't actually be honored while the app is fully
    // closed - the background task will just ping every cycle (~15 min)
    // in that case. Values of 15+ work as set.
    intervalMinutes: { type: Number, default: 30 },
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
