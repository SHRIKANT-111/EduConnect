const express = require('express');
const router = express.Router();
const { register, sendRegisterOTP, verifyRegisterOTP, login, sendLoginOTP, verifyLoginOTP, getProfile } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/send-register-otp', sendRegisterOTP);
router.post('/verify-register-otp', verifyRegisterOTP);
router.post('/login', login);
router.post('/send-login-otp', sendLoginOTP);
router.post('/verify-login-otp', verifyLoginOTP);
router.get('/profile', verifyToken, getProfile);

module.exports = router;