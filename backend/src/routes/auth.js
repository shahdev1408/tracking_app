const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken, requireAuth, requireManager } = require("../middleware/auth");

// POST /api/auth/register — employee self-registration
// Anyone can call this to create their own account (role is always "employee" here;
// managers are created manually in the database or promoted by an existing manager - see below)
router.post("/register", async (req, res) => {
  try {
    const { employeeId, name, phone, password } = req.body;
    if (!employeeId || !name || !password) {
      return res.status(400).json({ error: "employeeId, name, password are required" });
    }

    const existing = await User.findOne({ employeeId });
    if (existing) {
      return res.status(409).json({ error: "This employeeId is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ employeeId, name, phone, passwordHash, role: "employee" });

    const token = signToken(user);
    res.status(201).json({
      message: "Registered successfully",
      token,
      user: { employeeId: user.employeeId, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) {
      return res.status(400).json({ error: "employeeId and password are required" });
    }

    const user = await User.findOne({ employeeId });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Invalid credentials or account disabled" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);
    res.json({
      message: "Login successful",
      token,
      user: { employeeId: user.employeeId, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — check who the logged-in user is (used by mobile app on app start)
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findOne({ employeeId: req.user.employeeId }).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

// ===== Manager-only user management =====

// GET /api/auth/users — manager sees all employees + their last known location
router.get("/users", requireAuth, requireManager, async (req, res) => {
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
  res.json({ count: users.length, users });
});

// POST /api/auth/users — manager manually adds an employee (alternative to self-register)
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

// PUT /api/auth/users/:employeeId — manager edits an employee (name, phone, password, office hours)
router.put("/users/:employeeId", requireAuth, requireManager, async (req, res) => {
  try {
    const { name, phone, password, officeStartTime, officeEndTime, active, ratePerKm } = req.body;
    const update = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (officeStartTime) update.officeStartTime = officeStartTime;
    if (officeEndTime) update.officeEndTime = officeEndTime;
    if (typeof active === "boolean") update.active = active;
    if (typeof ratePerKm === "number") update.ratePerKm = ratePerKm;
    if (password) update.passwordHash = await bcrypt.hash(password, 10);

    const user = await User.findOneAndUpdate(
      { employeeId: req.params.employeeId },
      update,
      { new: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User updated", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:employeeId — manager deactivates an employee (soft delete, keeps payroll history)
router.delete("/users/:employeeId", requireAuth, requireManager, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { employeeId: req.params.employeeId },
      { active: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deactivated", employeeId: user.employeeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:employeeId/permanent — manager PERMANENTLY removes an employee record
// (only use this for mistakes - it does NOT delete their punch/ping history, so old payroll
// reports stay intact, but the account itself is gone and cannot log in or be recovered)
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
