const express = require("express");
const router = express.Router();

// Update these two values whenever you release a new APK build.
// Host the APK anywhere you like (Google Drive direct link, your own
// server's /public folder, Firebase App Distribution, etc.) and put that
// URL in DOWNLOAD_URL.
const LATEST_VERSION = "1.0.0";
const DOWNLOAD_URL = "https://your-download-link-here.com/app-latest.apk";

router.get("/", (req, res) => {
  res.json({ latestVersion: LATEST_VERSION, downloadUrl: DOWNLOAD_URL });
});

module.exports = router;
