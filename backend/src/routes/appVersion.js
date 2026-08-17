const express = require("express");
const router = express.Router();

// Update these two values whenever you release a new APK build.
// Host the APK anywhere you like (Google Drive direct link, your own
// server's /public folder, Firebase App Distribution, etc.) and put that
// URL in DOWNLOAD_URL.
const LATEST_VERSION = "1.1.0";
const DOWNLOAD_URL = "https://drive.google.com/uc?export=download&id=1_-lE5iQ9mhr29of2qeHJh_N-n7HtTUO_";

router.get("/", (req, res) => {
  res.json({ latestVersion: LATEST_VERSION, downloadUrl: DOWNLOAD_URL });
});

module.exports = router;
