const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const COOKIE_NAME = "auth_token";

const ADMIN_EMAILS = new Set(
    (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
);

function normalizeFrontendUrl(url) {
    if (!url) return "http://localhost:5173";
    return url.endsWith("/") ? url.slice(0, -1) : url;
}

const FRONTEND_BASE = normalizeFrontendUrl(process.env.FRONTEND_URL || "http://localhost:5173");
const ADMIN_REDIRECT_URL =
    process.env.ADMIN_DASHBOARD_URL || `${FRONTEND_BASE}/admin`;
const USER_REDIRECT_URL =
    process.env.USER_HOME_URL || `${FRONTEND_BASE}/`;

function resolveIsAdmin(user = {}) {
    if (typeof user.is_admin === "boolean") return user.is_admin;
    const email = (user.email || "").toLowerCase();
    return ADMIN_EMAILS.has(email);
}

function issueToken(user) {
    const payload = {
        sub: user.user_id,
        email: user.email,
        user_name: user.user_name,
        is_admin: !!user.is_admin,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
    });
}

function clearAuthCookie(res) {
    res.cookie(COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        expires: new Date(0),
        path: "/",
    });
}

function extractToken(req) {
    const header = req.get("Authorization") || "";
    if (header.startsWith("Bearer ")) return header.slice(7).trim();
    if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
    return null;
}

function attachUser(req, _res, next) {
    const token = extractToken(req);
    if (!token) return next();
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.sub;
        req.user = {
            user_id: payload.sub,
            email: payload.email,
            user_name: payload.user_name,
            is_admin: !!payload.is_admin,
        };
    } catch (err) {
        console.warn("Invalid auth token:", err.message);
    }
    return next();
}

function requireAuth(req, res, next) {
    if (!req.userId) {
        return res.status(401).json({ error: "Authentication required" });
    }
    return next();
}

function requireAdmin(req, res, next) {
    if (!req.userId || !req.user?.is_admin) {
        return res.status(403).json({ error: "Admin access required" });
    }
    return next();
}

module.exports = {
    attachUser,
    requireAuth,
    requireAdmin,
    issueToken,
    setAuthCookie,
    clearAuthCookie,
    resolveIsAdmin,
    ADMIN_REDIRECT_URL,
    USER_REDIRECT_URL,
    COOKIE_NAME,
};
