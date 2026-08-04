const express = require("express");
const router = express.Router();
const Punch = require("../models/Punch");
const User = require("../models/User");
const { evaluatePoint } = require("../utils/payRules");
const { requireAuth, requireManager } = require("../middleware/auth");
const { reverseGeocode } = require("../utils/geocode");
const { forwardPhotoToTesseract } = require("../utils/forwardTesseract");

router.post("/", requireAuth, async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      type, site, location, latitude, longitude, timestamp,
      punchCategory, workType, transportMode, photoType, photoBase64,
      deviceName, deviceId,
    } = req.body;

    if (!type || latitude == null || longitude == null) {
      return res.status(400).json({ error: "type, latitude, longitude are required" });
    }
    if (!["in", "out"].includes(type)) {
      return res.status(400).json({ error: "type must be 'in' or 'out'" });
    }
    if (!transportMode || !["personal_vehicle", "public_transport", "office_vehicle"].includes(transportMode)) {
      return res.status(400).json({ error: "transportMode must be one of personal_vehicle, public_transport, office_vehicle" });
    }
    if (!photoType || !["start", "end"].includes(photoType)) {
      return res.status(400).json({ error: "photoType must be 'start' or 'end'" });
    }
    if (!photoBase64) {
      return res.status(400).json({ error: "photoBase64 is required" });
    }

    const emp = await User.findOne({ employeeId });
    if (!emp || !emp.active) {
      return res.status(403).json({ error: "This account has been disabled by your manager" });
    }

    const ts = timestamp ? new Date(timestamp) : new Date();
    const { isSunday, isOfficeHours, billable } = evaluatePoint(ts, emp?.officeStartTime, emp?.officeEndTime);
    const placeName = await reverseGeocode(latitude, longitude);

    const punch = await Punch.create({
      employeeId, type, site, location, latitude, longitude, timestamp: ts,
      isSunday, isOfficeHours, billable, placeName,
      punchCategory, workType, transportMode, photoType, photoBase64,
      deviceName, deviceId,
    });

    await User.updateOne(
      { employeeId },
      { $set: {
        lastLocation: { latitude, longitude, timestamp: ts, placeName },
        lastDevice: { deviceName, deviceId, timestamp: ts },
      } }
    );

    res.status(201).json({ message: "Punch recorded", punch });

    // Forward photo to Tesseract OCR service (non-blocking). This is best-effort
    // and must not affect the main punch response if the OCR service is down.
    try {
      const punchIdStr = (punch && (punch._id ? punch._id.toString() : punch.id)) || null;
      if (punchIdStr && photoBase64) {
        // fire-and-forget
        forwardPhotoToTesseract(punchIdStr, photoBase64);
      }
    } catch (fwdErr) {
      console.log('Failed to forward photo to OCR service:', fwdErr.message);
    }
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
    const punches = await Punch.find(filter).sort({ timestamp: 1 });
    res.json({ count: punches.length, punches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/record/:punchId", requireAuth, requireManager, async (req, res) => {
  try {
    const deleted = await Punch.findByIdAndDelete(req.params.punchId);
    if (!deleted) return res.status(404).json({ error: "Punch record not found" });
    res.json({ message: "Punch record deleted", id: req.params.punchId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/ocr/:punchId", requireAuth, requireManager, async (req, res) => {
  try {
    const { text, confidence } = req.body;
    const update = {
      ocrResult: {
        text: text || null,
        confidence: typeof confidence === 'number' ? confidence : null,
        processedAt: new Date(),
      },
    };

    const punch = await Punch.findByIdAndUpdate(req.params.punchId, { $set: update }, { new: true, useFindAndModify: false });
    if (!punch) return res.status(404).json({ error: "Punch not found" });

    // If this is the latest OCR result for the employee, keep the user summary in sync.
    const existingLatest = punch.employeeId ? await User.findOne({ employeeId: punch.employeeId }).select('lastOcr') : null;
    if (existingLatest) {
      await User.updateOne(
        { employeeId: punch.employeeId },
        {
          $set: {
            lastOcr: {
              text: update.ocrResult.text,
              confidence: update.ocrResult.confidence,
              punchId: punch._id.toString(),
              processedAt: update.ocrResult.processedAt,
            },
          },
        }
      );
    }

    res.json({ message: "OCR result updated", punch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
