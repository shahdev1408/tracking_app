const express = require("express");
const router = express.Router();
const Ping = require("../models/Ping");
const User = require("../models/User");
const { evaluatePoint } = require("../utils/payRules");
const { requireAuth, requireManager } = require("../middleware/auth");
const { reverseGeocode } = require("../utils/geocode");

router.post("/ping", requireAuth, async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { latitude, longitude, timestamp, deviceName, deviceId, backgroundPermission } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "latitude, longitude are required" });
    }

    const emp = await User.findOne({ employeeId });
    if (!emp || !emp.active) {
      return res.status(403).json({ error: "This account has been disabled by your manager" });
    }

    const ts = timestamp ? new Date(timestamp) : new Date();
    const { isSunday, isOfficeHours, billable } = evaluatePoint(ts, emp?.officeStartTime, emp?.officeEndTime);
    const placeName = await reverseGeocode(latitude, longitude);

    const ping = await Ping.create({
      employeeId, latitude, longitude, timestamp: ts,
      isSunday, isOfficeHours, billable, placeName, deviceName, deviceId,
    });

    const updateObj = {
      lastLocation: { latitude, longitude, timestamp: ts, placeName },
      lastDevice: { deviceName, deviceId, timestamp: ts },
    };
    if (typeof backgroundPermission === 'boolean') updateObj.backgroundPermission = backgroundPermission;

    await User.updateOne({ employeeId }, { $set: updateObj });

    res.status(201).json({ message: "Ping recorded", ping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/latest/:employeeId", requireAuth, requireManager, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const user = await User.findOne({ employeeId }).select("employeeId lastLocation lastDevice backgroundPermission");
    if (!user) return res.status(404).json({ error: "Employee not found" });

    res.json({
      employeeId: user.employeeId,
      lastLocation: user.lastLocation || null,
      lastDevice: user.lastDevice || null,
      backgroundPermission: user.backgroundPermission,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/status/:employeeId", requireAuth, requireManager, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const user = await User.findOne({ employeeId }).select("employeeId lastLocation lastDevice backgroundPermission");
    if (!user) return res.status(404).json({ error: "Employee not found" });

    const lastLocation = user.lastLocation || null;
    const lastPingAgeMinutes = lastLocation?.timestamp
      ? Math.floor((Date.now() - new Date(lastLocation.timestamp).getTime()) / 60000)
      : null;
    const stale = lastPingAgeMinutes == null ? true : lastPingAgeMinutes > 15;

    res.json({
      employeeId: user.employeeId,
      lastLocation,
      lastDevice: user.lastDevice,
      backgroundPermission: user.backgroundPermission,
      lastPingAgeMinutes,
      stale,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.delete("/record/:pingId", requireAuth, requireManager, async (req, res) => {
  try {
    const deleted = await Ping.findByIdAndDelete(req.params.pingId);
    if (!deleted) return res.status(404).json({ error: "Ping record not found" });
    res.json({ message: "Ping record deleted", id: req.params.pingId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
