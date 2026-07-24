const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { requireAuth, requireManager } = require("../middleware/auth");

// POST /api/notifications/permission-reminder/:employeeId
// Marks that a reminder was sent. If you integrate push, send a notification here.
router.post("/permission-reminder/:employeeId", requireAuth, requireManager, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const user = await User.findOne({ employeeId });
    if (!user) return res.status(404).json({ error: "User not found" });

    user.lastPermissionReminderAt = new Date();
    await user.save();

    // TODO: Integrate push (FCM/APNs) to notify the device. For now, we record the reminder.
    res.json({ message: "Permission reminder recorded" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
