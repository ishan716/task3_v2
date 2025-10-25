const express = require('express');
const { getAdminDashboard } = require('../../controllers/adminController');
const { verifyAdmin } = require('../../middlewares/verifyAdmin');

const router = express.Router();
router.get('/dashboard', verifyAdmin, getAdminDashboard);

module.exports = router;
