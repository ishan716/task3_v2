const express = require('express');
const { adminLogin, getAdminDashboard } = require('../../controllers/adminController');
const verifyAdmin = require('../../middlewares/verifyAdmin');

const router = express.Router();

// Admin login
router.post('/login', adminLogin);

// Protected admin dashboard
router.get('/dashboard', verifyAdmin, getAdminDashboard);

module.exports = router;
