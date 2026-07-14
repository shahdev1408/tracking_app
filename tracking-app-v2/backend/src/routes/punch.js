const express = require("express");
const router = express.Router();
const Punch = require("../models/Punch");
const User = require("../models/User");
const { evaluatePoint } = require("../utils/payRules");
const { requireAuth, requireManager } = require("../middleware/auth");
const { reverseGeocode } = require("../utils/geocode");

// POST /api/punch  — employee taps "punch in" or "punch out" on the app
router.post("/", requireAuth, async (req, res) => {
  try {
    const employeeId = req.user.employeeId; // from logged-in token, not request body
    const { type, site, location, latitude, longitude, timestamp } = req.body;

    if (!type || latitude == null || longitude == null) {
      return res.status(400).json({ error: "type, latitude, longitude are required" });
    }
    if (!["in", "out"].includes(type)) {
      return res.status(400).json({ error: "type must be 'in' or 'out'" });
    }

    const emp = await User.findOne({ employeeId });
    const ts = timestamp ? new Date(timestamp) : new Date();

    const { isSunday, isOfficeHours, billable } = evaluatePoint(
      ts,
      emp?.officeStartTime,
      emp?.officeEndTime
    );

    // Look up the place name (won't block/slow the response if it's slow or fails)
    const placeName = await reverseGeocode(latitude, longitude);

    const punch = await Punch.create({
      employeeId, type, site, location, latitude, longitude,
      timestamp: ts, isSunday, isOfficeHours, billable, placeName,
    });

    // Also update last known location so manager's live map reflects punches too
    await User.updateOne(
      { employeeId },
      { lastLocation: { latitude, longitude, timestamp: ts, placeName } }
    );

    res.status(201).json({ message: "Punch recorded", punch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/punch/:employeeId — list punches for an employee (optional ?from=&to=)
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
    const punches = await Punch.find(filter).sort({ timestamp: 1 });
    res.json({ count: punches.length, punches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/punch/record/:punchId — manager deletes one specific punch entry (e.g. test data, mistakes)
router.delete("/record/:punchId", requireAuth, requireManager, async (req, res) => {
  try {
    const deleted = await Punch.findByIdAndDelete(req.params.punchId);
    if (!deleted) return res.status(404).json({ error: "Punch record not found" });
    res.json({ message: "Punch record deleted", id: req.params.punchId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
