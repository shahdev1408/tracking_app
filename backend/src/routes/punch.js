const express = require("express");
const router = express.Router();
const Punch = require("../models/Punch");
const Employee = require("../models/Employee");
const { evaluatePoint } = require("../utils/payRules");

// POST /api/punch  — employee taps "punch in" or "punch out" on the app
router.post("/", async (req, res) => {
  try {
    const { employeeId, type, site, location, latitude, longitude, timestamp } = req.body;

    if (!employeeId || !type || latitude == null || longitude == null) {
      return res.status(400).json({ error: "employeeId, type, latitude, longitude are required" });
    }
    if (!["in", "out"].includes(type)) {
      return res.status(400).json({ error: "type must be 'in' or 'out'" });
    }

    const emp = await Employee.findOne({ employeeId });
    const ts = timestamp ? new Date(timestamp) : new Date();

    const { isSunday, isOfficeHours, billable } = evaluatePoint(
      ts,
      emp?.officeStartTime,
      emp?.officeEndTime
    );

    const punch = await Punch.create({
      employeeId, type, site, location, latitude, longitude,
      timestamp: ts, isSunday, isOfficeHours, billable,
    });

    res.status(201).json({ message: "Punch recorded", punch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/punch/:employeeId — list punches for an employee (optional ?from=&to=)
router.get("/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { from, to } = req.query;
    const filter = { employeeId };
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }
    const punches = await Punch.find(filter).sort({ timestamp: 1 });
    res.json({ count: punches.length, punches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
