const express = require("express");
const router = express.Router();
const Ping = require("../models/Ping");
const Punch = require("../models/Punch");
const User = require("../models/User");
const { totalDistanceKm } = require("../utils/distance");
const { buildDailySummary } = require("../utils/dailySummary");
const { requireAuth, requireManager } = require("../middleware/auth");

/**
 * GET /api/reports/km/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Calculates total km travelled and splits into billable vs personal (Sunday),
 * using the background pings (more granular than punches).
 */
router.get("/km/:employeeId", requireAuth, async (req, res) => {
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

    const billablePoints = pings.filter(p => p.billable);
    const personalPoints = pings.filter(p => !p.billable);

    const billableKm = totalDistanceKm(billablePoints);
    const personalKm = totalDistanceKm(personalPoints);
    const totalKm = totalDistanceKm(pings);

    res.json({
      employeeId,
      totalPoints: pings.length,
      totalKm: Number(totalKm.toFixed(2)),
      billableKm: Number(billableKm.toFixed(2)),
      personalKm: Number(personalKm.toFixed(2)),
      note: "billableKm = company pays, personalKm = Sunday/off-hours travel excluded from pay",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/daily/:employeeId?from=&to=
 * Manager-only: day-by-day breakdown for payroll - first punch, last punch,
 * total/billable/personal km, and the full route for map display.
 */
router.get("/daily/:employeeId", requireAuth, requireManager, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { from, to } = req.query;

    const emp = await User.findOne({ employeeId });
    const ratePerKm = emp?.ratePerKm || 0;

    const filter = { employeeId };
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const pings = await Ping.find(filter).sort({ timestamp: 1 });
    const punches = await Punch.find(filter).sort({ timestamp: 1 });

    const { days, totals } = buildDailySummary(pings, punches, ratePerKm);
    res.json({ employeeId, ratePerKm, days, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
