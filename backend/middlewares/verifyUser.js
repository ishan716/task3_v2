const jwt = require("jsonwebtoken");
require("dotenv").config(); // Loads JWT_SECRET from .env

// Helper function to safely get JWT secret
const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("Missing JWT_SECRET in .env file");
    }
    return process.env.JWT_SECRET;
};

// ================= VERIFY TOKEN MIDDLEWARE ==================
const verifyToken = (req, res, next) => {
    try {
        // Expecting header format: "Authorization: Bearer <token>"
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(403).json({ message: "Token required" });
        }

        // Verify and decode the token
        const decoded = jwt.verify(token, getJwtSecret());
        req.user = decoded; // Attach decoded payload to req.user
        next();
    } catch (err) {
        console.error("Token verification error:", err.message);
        res.status(401).json({ message: "Invalid or expired token" });
    }
};

module.exports = verifyToken;
