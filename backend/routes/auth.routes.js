const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../db");
const {
    issueToken,
    setAuthCookie,
    clearAuthCookie,
    requireAuth,
    resolveIsAdmin,
    ADMIN_REDIRECT_URL,
    USER_REDIRECT_URL,
} = require("../middleware/auth");

const router = express.Router();

function sanitizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

async function verifyPassword(input, stored) {
    const incoming = String(input || "");
    const hashed = String(stored || "");
    if (!incoming || !hashed) return false;
    try {
        return await bcrypt.compare(incoming, hashed);
    } catch {
        return incoming === hashed;
    }
}

router.post("/signup", async (req, res) => {
    const user_name = String(req.body?.user_name || "").trim();
    const email = sanitizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!user_name || !email || !password) {
        return res
            .status(400)
            .json({ error: "user_name, email and password are required" });
    }

    try {
        const { data: existing, error: existingError } = await supabase
            .from("users")
            .select("user_id")
            .ilike("email", email);

        if (existingError) throw existingError;
        if (Array.isArray(existing) && existing.length) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data: inserted, error: insertError } = await supabase
            .from("users")
            .insert([
                {
                    user_name,
                    email,
                    password: hashedPassword,
                },
            ])
            .select("user_id, user_name, email")
            .single();

        if (insertError) throw insertError;

        const isAdmin = resolveIsAdmin({ email });
        const publicUser = {
            user_id: inserted.user_id,
            user_name: inserted.user_name,
            email: inserted.email,
            is_admin: isAdmin,
        };

        const token = issueToken(publicUser);
        setAuthCookie(res, token);

        return res.status(201).json({
            token,
            user: publicUser,
            redirectTo: publicUser.is_admin ? ADMIN_REDIRECT_URL : USER_REDIRECT_URL,
        });
    } catch (err) {
        console.error("Signup error:", err.message);
        res.status(500).json({ error: "Failed to create account" });
    }
});

router.post("/login", async (req, res) => {
    const email = sanitizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const { data: user, error } = await supabase
            .from("users")
            .select("user_id, user_name, email, password")
            .ilike("email", email)
            .single();

        if (error) {
            console.error("Login query error:", error.message);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const passwordMatch = await verifyPassword(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isAdmin = resolveIsAdmin(user);
        const publicUser = {
            user_id: user.user_id,
            user_name: user.user_name,
            email: user.email,
            is_admin: isAdmin,
        };

        const token = issueToken({ ...publicUser, is_admin: isAdmin });
        setAuthCookie(res, token);

        res.json({
            token,
            user: publicUser,
            redirectTo: isAdmin ? ADMIN_REDIRECT_URL : USER_REDIRECT_URL,
        });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ error: "Failed to login" });
    }
});

router.post("/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
});

router.get("/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
