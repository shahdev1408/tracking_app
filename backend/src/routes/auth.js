const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken, requireAuth, requireManager } = require("../middleware/auth");

router.post("/register", requireAuth, requireManager, async (req, res) => {
  try {
    const { employeeId, name, phone, password } = req.body;
    if (!employeeId || !name || !password) {
      return res.status(400).json({ error: "employeeId, name, password are required" });
    }
    const existing = await User.findOne({ employeeId });
    if (existing) return res.status(409).json({ error: "This employeeId is already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ employeeId, name, phone, passwordHash, role: "employee" });

    const token = signToken(user);
    res.status(201).json({
      message: "Registered successfully", token,
      user: { employeeId: user.employeeId, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { employeeId, password, deviceName, deviceId } = req.body;
    if (!employeeId || !password) {
      return res.status(400).json({ error: "employeeId and password are required" });
    }
    const user = await User.findOne({ employeeId });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.active) return res.status(403).json({ error: "This account has been disabled by your manager" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    if (deviceName || deviceId) {
      user.lastDevice = { deviceName, deviceId, timestamp: new Date() };
      await user.save();
    }

    const token = signToken(user);
    res.json({
      message: "Login successful", token,
      user: { employeeId: user.employeeId, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findOne({ employeeId: req.user.employeeId }).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

// ===== Manager-only user management =====

router.get("/users", requireAuth, requireManager, async (req, res) => {
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
  res.json({ count: users.length, users });
});

router.post("/users", requireAuth, requireManager, async (req, res) => {
  try {
    const { employeeId, name, phone, password, role, ratePerKm } = req.body;
    if (!employeeId || !name || !password) {
      return res.status(400).json({ error: "employeeId, name, password are required" });
    }
    const existing = await User.findOne({ employeeId });
    if (existing) return res.status(409).json({ error: "employeeId already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      employeeId, name, phone, passwordHash,
      role: role === "manager" ? "manager" : "employee",
      ratePerKm: typeof ratePerKm === "number" ? ratePerKm : 0,
    });
    res.status(201).json({ message: "User created", user: { employeeId: user.employeeId, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/users/:employeeId", requireAuth, requireManager, async (req, res) => {
  try {
    const { name, phone, password, officeStartTime, officeEndTime, active, ratePerKm, startPoint, endPoint } = req.body;
    const update = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (officeStartTime) update.officeStartTime = officeStartTime;
    if (officeEndTime) update.officeEndTime = officeEndTime;
    if (typeof active === "boolean") update.active = active;
    if (typeof ratePerKm === "number") update.ratePerKm = ratePerKm;
    if (password) update.passwordHash = await bcrypt.hash(password, 10);
    if (startPoint && typeof startPoint.latitude === "number" && typeof startPoint.longitude === "number") {
      update.startPoint = { latitude: startPoint.latitude, longitude: startPoint.longitude };
    }
    if (endPoint && typeof endPoint.latitude === "number" && typeof endPoint.longitude === "number") {
      update.endPoint = { latitude: endPoint.latitude, longitude: endPoint.longitude };
    }

    const user = await User.findOneAndUpdate(
      { employeeId: req.params.employeeId }, { $set: update }, { new: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User updated", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quick enable/disable toggle (separate from full edit, for the dashboard switch)
router.put("/users/:employeeId/toggle-active", requireAuth, requireManager, async (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== "boolean") return res.status(400).json({ error: "active (boolean) is required" });

    const user = await User.findOneAndUpdate(
      { employeeId: req.params.employeeId }, { $set: { active } }, { new: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: `User ${active ? "enabled" : "disabled"}`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set/update the auto-tracking schedule for one employee
router.put("/users/:employeeId/schedule", requireAuth, requireManager, async (req, res) => {
  try {
    const { enabled, days, startTime, endTime, intervalMinutes } = req.body;

    const existing = await User.findOne({ employeeId: req.params.employeeId });
    if (!existing) return res.status(404).json({ error: "User not found" });

    // Merge onto the existing schedule rather than replacing it outright,
    // so a save that only sends some fields doesn't blank out the others.
    const merged = {
      enabled: typeof enabled === "boolean" ? enabled : existing.autoSchedule?.enabled ?? false,
      days: Array.isArray(days) ? days : existing.autoSchedule?.days ?? [],
      startTime: startTime || existing.autoSchedule?.startTime || "08:00",
      endTime: endTime || existing.autoSchedule?.endTime || "20:00",
      // Android OS enforces a hard ~15 min minimum between background
      // wake-ups. Enforce it server-side so direct API calls can't set an
      // interval below 15 (the RN background tracker already relies on
      // >= 15 for the schedule-based auto track). Existing values below 15
      // are bumped up to 15 to keep behavior consistent.
      intervalMinutes: typeof intervalMinutes === "number" && intervalMinutes >= 15
        ? intervalMinutes
        : (existing.autoSchedule?.intervalMinutes ?? 30) >= 15
          ? existing.autoSchedule?.intervalMinutes ?? 30
          : 15,
    };

    const user = await User.findOneAndUpdate(
      { employeeId: req.params.employeeId }, { $set: { autoSchedule: merged } }, { new: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Schedule updated", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/users/:employeeId", requireAuth, requireManager, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { employeeId: req.params.employeeId }, { $set: { active: false } }, { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deactivated", employeeId: user.employeeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/users/:employeeId/permanent", requireAuth, requireManager, async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ employeeId: req.params.employeeId });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User permanently deleted", employeeId: user.employeeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
