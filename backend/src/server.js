require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const rateLimit = require("express-rate-limit");

const punchRoutes = require("./routes/punch");
const trackingRoutes = require("./routes/tracking");
const reportRoutes = require("./routes/reports");
const authRoutes = require("./routes/auth");
const appVersionRoutes = require("./routes/appVersion");
const notificationsRoutes = require("./routes/notifications");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // higher limit to allow base64 photo uploads

// Rate limiting: general API limiter (300 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for auth routes (30 requests per 15 minutes per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Tracking app backend running" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/punch", apiLimiter, punchRoutes);
app.use("/api/tracking", apiLimiter, trackingRoutes);
app.use("/api/reports", apiLimiter, reportRoutes);
app.use("/api/app-version", apiLimiter, appVersionRoutes);
app.use("/api/notifications", apiLimiter, notificationsRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/tracking-app";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
