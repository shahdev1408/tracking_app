const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

function signToken(user) {
  return jwt.sign(
    { employeeId: user.employeeId, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// Verifies token, attaches decoded user info to req.user
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Use after requireAuth - only lets managers through
function requireManager(req, res, next) {
  if (req.user?.role !== "manager") {
    return res.status(403).json({ error: "Manager access only" });
  }
  next();
}

module.exports = { signToken, requireAuth, requireManager, JWT_SECRET };
