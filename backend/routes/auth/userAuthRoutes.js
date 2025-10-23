const express = require('express');
const { userRegister, userLogin } = require('../../controllers/userController');

const router = express.Router();

// 🆕 Register
router.post('/register', userRegister);

// 🔐 Login
router.post('/login', userLogin);

module.exports = router;
