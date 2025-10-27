// Keep admin authentication logic consistent with userController but use the `admins` table.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
require('dotenv').config();

// Helper to get JWT secret with clear error
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

// ================= REGISTER ADMIN ==================
const registerAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if admin exists
    const { data: existingAdmin, error: existingErr } = await supabase
      .from('admins')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingErr) {
      console.error('Supabase error (check existing admin):', existingErr);
      return res.status(500).json({ message: 'Database error' });
    }

    if (existingAdmin)
      return res.status(400).json({ message: 'Email already registered' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin
    const { data, error } = await supabase
      .from('admins')
      .insert([{ email: normalizedEmail, password: hashedPassword }])
      .select();

    if (error) {
      console.error('Supabase error (insert admin):', error);
      return res.status(500).json({ message: 'Database error' });
    }

    const created = data?.[0];
    if (!created) return res.status(500).json({ message: 'Admin creation failed' });

    const adminId = created.id ?? created.admin_id ?? null;

    // Generate JWT
    const token = jwt.sign(
      {
        admin_id: adminId,
        email: created.email,
        role: 'admin',
      },
      getJwtSecret(),
      { expiresIn: '2h' }
    );

    res.status(201).json({
      message: 'Admin registered successfully',
      admin: {
        id: adminId,
        email: created.email,
        role: 'admin',
      },
      token,
    });
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('❌ Admin Register Error:', msg);
    if (msg.includes('JWT_SECRET')) {
      return res
        .status(500)
        .json({ message: 'Server misconfiguration: JWT secret missing' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// ================= LOGIN ADMIN ==================
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password required' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error('Supabase error (fetch admin):', error);
      return res.status(500).json({ message: 'Database error' });
    }

    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const adminId = admin.id ?? admin.admin_id ?? null;

    // Generate JWT
    const token = jwt.sign(
      {
        admin_id: adminId,
        email: admin.email,
        role: 'admin',
      },
      getJwtSecret(),
      { expiresIn: '2h' }
    );

    res.status(200).json({
      message: 'Login successful',
      admin: {
        id: adminId,
        email: admin.email,
        role: 'admin',
      },
      token,
    });
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('❌ Admin Login Error:', msg);
    if (msg.includes('JWT_SECRET')) {
      return res
        .status(500)
        .json({ message: 'Server misconfiguration: JWT secret missing' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};



module.exports = { registerAdmin, loginAdmin};

