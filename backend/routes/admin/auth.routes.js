const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const supabase = require('../../db.js');
const { verifyToken, verifyAdmin } = require('../../middleware/adminAuthMiddleware.js');

dotenv.config();
const router = express.Router();

// ✅ Admin Signup (Updated)
router.post("/signup",async(req,res)=>{
    const {email,password,full_name}=req.body;

    if(!email||!password||!full_name){
        return res.status(400).json({massege:"Email,password and full_name are required"});
    }
    try{
        const{data:existing} =await supabase
            .from("admin")
            .select("*")
            .eq("email",email)
            .single();
        if (existing) return res.status(400).json({massege:"Email already exists"});

        const hashedPassword=await bcrypt.hash(password,10);

        const{error}=await supabase
            .from("admin")
            .insert([{email,password:hashedPassword,full_name}]);

        if(error) throw error;
        res.status(201).json({massege:"Admin registered successfully"});
    }catch(err){
        res.status(500).json({massege:err.message});
    }

})

// ✅ Admin Login (Updated)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: admin, error } = await supabase
            .from('admin') // 6. Changed 'admins' to 'admin'
            .select('*')
            .eq('email', email)
            .single();

        if (error || !admin) return res.status(401).json({ message: 'Invalid credentials' });

        const match = await bcrypt.compare(password, admin.password);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });

        // The JWT payload is fine. We are logically saying
        // anyone who successfully logs in via this route IS an admin.
        const token = jwt.sign(
            { id: admin.id, email: admin.email, isAdmin: true },
            process.env.JWT_SECRET,
            { expiresIn: '128h' }
        );

        res.status(200).json({ token });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ Protected Admin Dashboard (No changes needed)
router.get('/dashboard', verifyToken, verifyAdmin, (req, res) => {
    res.json({ message: `Welcome, Admin ${req.user.email}!` });
});

module.exports = router;