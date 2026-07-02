const express = require("express");
const router = express.Router();
const Ping = require("../models/Ping");
const Punch = require("../models/Punch");
const { totalDistanceKm } = require("../utils/distance");

/**
 * GET /api/reports/km/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Calculates total km travelled and splits into billable vs personal (Sunday),
 * using the background pings (more granular than punches).
 */
router.get("/km/:employeeId", async (req, res) => {
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

module.exports = router;
