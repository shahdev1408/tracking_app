const express = require("express");
const router = express.Router();
const Ping = require("../models/Ping");
const Punch = require("../models/Punch");
const User = require("../models/User");
const { totalDistanceKm } = require("../utils/distance");
const { buildDailySummary } = require("../utils/dailySummary");
const { requireAuth, requireManager } = require("../middleware/auth");

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
      employeeId, totalPoints: pings.length,
      totalKm: Number(totalKm.toFixed(2)),
      billableKm: Number(billableKm.toFixed(2)),
      personalKm: Number(personalKm.toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    const { days, totals } = buildDailySummary(pings, punches, ratePerKm, emp?.startPoint, emp?.endPoint);
    res.json({ employeeId, ratePerKm, days, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/export/:employeeId", requireAuth, requireManager, async (req, res) => {
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

    const { days, totals } = buildDailySummary(pings, punches, ratePerKm, emp?.startPoint, emp?.endPoint);

    const csvField = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const header = [
      "Date", "Punch In", "Punch In Device", "Punch Out", "Punch Out Device",
      "Category", "Work Type", "Manual Count", "Auto Count",
      "Total Km", "Billable Km", "Personal Km", "Pay",
    ].join(",") + "\n";

    const rows = days.map((d) => {
      const inPunch = d.manualPunches.find((p) => p.kind === "punch_in" || p.type === "in");
      const outPunch = [...d.manualPunches].reverse().find((p) => p.kind === "punch_out" || p.type === "out");
      const inTime = d.punchInTime ? new Date(d.punchInTime).toLocaleTimeString() : "";
      const outTime = d.punchOutTime ? new Date(d.punchOutTime).toLocaleTimeString() : "";
      const inDevice = inPunch ? [inPunch.deviceName, inPunch.deviceId].filter(Boolean).join(" / ") : "";
      const outDevice = outPunch ? [outPunch.deviceName, outPunch.deviceId].filter(Boolean).join(" / ") : "";
      const category = inPunch?.punchCategory || "";
      const workType = inPunch?.workType || "";

      return [
        d.date, inTime, csvField(inDevice), outTime, csvField(outDevice),
        category, workType, d.punchCount, d.pingCount,
        d.totalKm, d.billableKm, d.personalKm, d.pay,
      ].join(",");
    }).join("\n");

    const totalRow = `\nTOTAL,,,,,,,,,${totals.totalKm},${totals.billableKm},${totals.personalKm},${totals.pay}`;

    const csv = header + rows + totalRow;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${employeeId}-report.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;