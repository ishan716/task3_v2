const jwt = require("jsonwebtoken");
require("dotenv").config(); // Load environment variables

// Helper to get JWT secret safely
const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("Missing JWT_SECRET in .env file");
    }
    return process.env.JWT_SECRET;
};

// ================= VERIFY ADMIN TOKEN ==================
const verifyAdminToken = (req, res, next) => {
    try {
        // Expecting: Authorization: Bearer <token>
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(403).json({ message: "Token required" });
        }

        // Verify token
        const decoded = jwt.verify(token, getJwtSecret());

        // Check role
        if (decoded?.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        req.admin = decoded; // attach admin info to request
        next();
    } catch (err) {
        console.error("Admin token verification failed:", err.message);
        res.status(401).json({ message: "Invalid or expired token" });
    }
};

module.exports = verifyAdminToken;
