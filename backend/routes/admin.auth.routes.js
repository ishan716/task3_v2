import express from "express";
import supabase from "../db.js";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "✅ User registered successfully", data });
});

// LOGIN
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "✅ Logged in successfully", data });
});

// GET CURRENT USER
router.get("/me", authMiddleware, async (req, res) => {
    res.json({ user: req.user });
});

export default router;
