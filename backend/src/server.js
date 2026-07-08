require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const punchRoutes = require("./routes/punch");
const trackingRoutes = require("./routes/tracking");
const reportRoutes = require("./routes/reports");
const authRoutes = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the admin dashboard (public/admin.html) as static files
app.use(express.static(path.join(__dirname, "../public")));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Tracking app backend running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/punch", punchRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/reports", reportRoutes);

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
