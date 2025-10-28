const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
require('dotenv').config();

// Helper to get JWT secret with clear error
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        // Provide explicit message instead of generic 500 so it's easier to diagnose
        throw new Error('JWT_SECRET is not configured');
    }
    return secret;
}

// ================= REGISTER ==================
const registerUser = async (req, res) => {
    const { user_name, email, password } = req.body;

    if (!user_name || !email || !password)
        return res.status(400).json({ message: "All fields are required" });

    try {
        const normalizedEmail = String(email).trim().toLowerCase();

        // Check if user exists (use maybeSingle to avoid error when 0 rows)
        const { data: existingUser, error: existingErr } = await supabase
            .from('users')
            .select('user_id, email')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existingErr) {
            console.error('Supabase error (check existing user):', existingErr);
            return res.status(500).json({ message: 'Database error' });
        }

        if (existingUser)
            return res.status(400).json({ message: "Email already registered" });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const { data, error } = await supabase
            .from('users')
            .insert([{ user_name, email: normalizedEmail, password: hashedPassword }])
            .select();

        if (error) {
            console.error('Supabase error (insert user):', error);
            return res.status(500).json({ message: 'Database error' });
        }

        const created = data?.[0];
        if (!created) return res.status(500).json({ message: 'User creation failed' });

        // Generate JWT
        const token = jwt.sign(
            {
                user_id: created.user_id,
                email: created.email,
                role: 'user',
            },
            getJwtSecret(),
            { expiresIn: '2h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                user_id: created.user_id,
                user_name: created.user_name,
                email: created.email,
                role: 'user',
            },
            token,
        });
    } catch (err) {
        const msg = err?.message || String(err);
        console.error('❌ Register Error:', msg);
        if (msg.includes('JWT_SECRET')) {
            return res.status(500).json({ message: 'Server misconfiguration: JWT secret missing' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// ================= LOGIN ==================
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ message: "Email and password required" });

    try {
        const normalizedEmail = String(email).trim().toLowerCase();

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (error) {
            console.error('Supabase error (fetch user):', error);
            return res.status(500).json({ message: 'Database error' });
        }

        if (!user)
            return res.status(404).json({ message: "User not found" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ message: "Invalid credentials" });

        // Generate JWT
        const token = jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
                role: 'user',
            },
            getJwtSecret(),
            { expiresIn: '2h' }
        );

        res.status(200).json({
            message: 'Login successful',
            user: {
                user_id: user.user_id,
                user_name: user.user_name,
                email: user.email,
                role: 'user',
            },
            token,
        });
    } catch (err) {
        const msg = err?.message || String(err);
        console.error('❌ Login Error:', msg);
        if (msg.includes('JWT_SECRET')) {
            return res.status(500).json({ message: 'Server misconfiguration: JWT secret missing' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};



module.exports = { registerUser, loginUser};
