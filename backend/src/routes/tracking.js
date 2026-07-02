const express = require("express");
const router = express.Router();
const Ping = require("../models/Ping");
const Employee = require("../models/Employee");
const { evaluatePoint } = require("../utils/payRules");

// POST /api/tracking/ping — mobile app calls this every 30 min in the background
router.post("/ping", async (req, res) => {
  try {
    const { employeeId, latitude, longitude, timestamp } = req.body;

    if (!employeeId || latitude == null || longitude == null) {
      return res.status(400).json({ error: "employeeId, latitude, longitude are required" });
    }

    const emp = await Employee.findOne({ employeeId });
    const ts = timestamp ? new Date(timestamp) : new Date();

    const { isSunday, isOfficeHours, billable } = evaluatePoint(
      ts,
      emp?.officeStartTime,
      emp?.officeEndTime
    );

    const ping = await Ping.create({
      employeeId, latitude, longitude, timestamp: ts,
      isSunday, isOfficeHours, billable,
    });

    res.status(201).json({ message: "Ping recorded", ping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tracking/:employeeId — list pings for an employee (optional ?from=&to=)
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
    const pings = await Ping.find(filter).sort({ timestamp: 1 });
    res.json({ count: pings.length, pings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
