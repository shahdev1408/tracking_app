const express = require("express");
const router = express.Router();
const Ping = require("../models/Ping");
const User = require("../models/User");
const { evaluatePoint } = require("../utils/payRules");
const { requireAuth } = require("../middleware/auth");
const { reverseGeocode } = require("../utils/geocode");

// POST /api/tracking/ping — mobile app calls this automatically (every 1km moved or 15-30 min)
router.post("/ping", requireAuth, async (req, res) => {
  try {
    const employeeId = req.user.employeeId; // taken from the logged-in token, not the request body
    const { latitude, longitude, timestamp } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "latitude, longitude are required" });
    }

    const emp = await User.findOne({ employeeId });
    const ts = timestamp ? new Date(timestamp) : new Date();

    const { isSunday, isOfficeHours, billable } = evaluatePoint(
      ts,
      emp?.officeStartTime,
      emp?.officeEndTime
    );

    const placeName = await reverseGeocode(latitude, longitude);

    const ping = await Ping.create({
      employeeId, latitude, longitude, timestamp: ts,
      isSunday, isOfficeHours, billable, placeName,
    });

    // Update the employee's last known location (for the manager's live map)
    await User.updateOne(
      { employeeId },
      { lastLocation: { latitude, longitude, timestamp: ts, placeName } }
    );

    res.status(201).json({ message: "Ping recorded", ping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tracking/:employeeId — list pings for an employee (optional ?from=&to=)
router.get("/:employeeId", requireAuth, async (req, res) => {
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
