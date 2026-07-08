const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true }, // e.g. EMP001, chosen at registration
  name: { type: String, required: true },
  phone: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["employee", "manager"], default: "employee" },
  officeStartTime: { type: String, default: "09:30" },
  officeEndTime: { type: String, default: "18:30" },
  ratePerKm: { type: Number, default: 0 }, // pay rate per billable km, set by manager
  active: { type: Boolean, default: true }, // manager can deactivate instead of hard-delete
  lastLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
