const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const twilio = require('twilio');
require('dotenv').config();

// Twilio client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// In-memory OTP store
const otpStore = {};

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Generate unique ID: TCH-0001 or STU-0001
const generateUniqueId = async (role) => {
    const prefix = role === 'teacher' ? 'TCH' : 'STU';
    const [rows] = await db.execute(
        'SELECT unique_id FROM users WHERE role = ? ORDER BY id DESC LIMIT 1',
        [role]
    );
    if (rows.length === 0) return `${prefix}-0001`;
    const lastId = parseInt(rows[0].unique_id.split('-')[1]);
    return `${prefix}-${String(lastId + 1).padStart(4, '0')}`;
};

// SEND SMS via Twilio
const sendSMS = async (mobile, otp) => {
    try {
        const message = await twilioClient.messages.create({
            body: `Your EduConnect OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: `+91${mobile}`
        });
        console.log(`\n📱 SMS sent to +91${mobile} | SID: ${message.sid}\n`);
        return true;
    } catch (err) {
        console.error('Twilio SMS error:', err.message);
        return false;
    }
};

// REGISTER
const register = async (req, res) => {
    try {
        const { full_name, email, password, role, phone, otp, mobile_verified } = req.body;
        if (!full_name || !email || !password || !role || !phone)
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        if (!['teacher', 'student'].includes(role))
            return res.status(400).json({ success: false, message: 'Role must be teacher or student.' });
        if (!/^[6-9]\d{9}$/.test(phone))
            return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });

        // Check duplicates
        const [emailCheck] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (emailCheck.length > 0)
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        const [mobileCheck] = await db.execute('SELECT id FROM users WHERE phone = ?', [phone]);
        if (mobileCheck.length > 0)
            return res.status(409).json({ success: false, message: 'This mobile number is already registered.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const uniqueId = await generateUniqueId(role);

        await db.execute(
            'INSERT INTO users (unique_id, full_name, email, password, role, phone, is_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [uniqueId, full_name, email, hashedPassword, role, phone]
        );

        res.status(201).json({
            success: true,
            message: 'Account created and verified successfully!',
            unique_id: uniqueId
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
};

// SEND REGISTRATION OTP
const sendRegisterOTP = async (req, res) => {
    try {
        const { mobile, email, full_name } = req.body;
        if (!mobile || !email || !full_name)
            return res.status(400).json({ success: false, message: 'Name, email and mobile required.' });
        if (!/^[6-9]\d{9}$/.test(mobile))
            return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });

        // Check duplicates before sending OTP
        const [emailCheck] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (emailCheck.length > 0)
            return res.status(409).json({ success: false, message: 'This email is already registered.' });
        const [mobileCheck] = await db.execute('SELECT id FROM users WHERE phone = ?', [mobile]);
        if (mobileCheck.length > 0)
            return res.status(409).json({ success: false, message: 'This mobile number is already registered. Each person can only have one account.' });

        const otp = generateOTP();
        otpStore[`reg_${mobile}`] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

        const sent = await sendSMS(mobile, otp);

        if (sent) {
            res.json({ success: true, message: `OTP sent to +91${mobile}. Check your messages!` });
        } else {
            // SMS failed — remove OTP store and return error
            delete otpStore[`reg_${mobile}`];
            res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
        }
    } catch (err) {
        console.error('sendRegisterOTP error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// VERIFY REGISTER OTP
const verifyRegisterOTP = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        if (!mobile || !otp)
            return res.status(400).json({ success: false, message: 'Mobile and OTP required.' });
        const record = otpStore[`reg_${mobile}`];
        if (!record)
            return res.status(400).json({ success: false, message: 'No OTP found. Please request again.' });
        if (Date.now() > record.expiresAt) {
            delete otpStore[`reg_${mobile}`];
            return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
        }
        if (record.otp !== otp.trim())
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });

        // Keep OTP in store until account is actually created
        res.json({ success: true, message: 'Mobile number verified successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// LOGIN with password
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email and password required.' });
        const [users] = await db.execute('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
        if (users.length === 0)
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, unique_id: user.unique_id, full_name: user.full_name },
            process.env.JWT_SECRET, { expiresIn: '7d' }
        );
        res.json({
            success: true, message: 'Login successful!', token,
            user: { id: user.id, unique_id: user.unique_id, full_name: user.full_name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
};

// SEND LOGIN OTP
const sendLoginOTP = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile)
            return res.status(400).json({ success: false, message: 'Mobile number required.' });
        if (!/^[6-9]\d{9}$/.test(mobile))
            return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number.' });

        const [users] = await db.execute('SELECT * FROM users WHERE phone = ? AND is_active = 1', [mobile]);
        if (users.length === 0)
            return res.status(404).json({ success: false, message: 'No account found with this mobile number.' });

        const otp = generateOTP();
        otpStore[`login_${mobile}`] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

        const sent = await sendSMS(mobile, otp);

        if (sent) {
            res.json({ success: true, message: `OTP sent to +91${mobile}. Check your messages!` });
        } else {
            delete otpStore[`login_${mobile}`];
            res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
        }
    } catch (err) {
        console.error('sendLoginOTP error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// VERIFY LOGIN OTP
const verifyLoginOTP = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        if (!mobile || !otp)
            return res.status(400).json({ success: false, message: 'Mobile and OTP required.' });
        const record = otpStore[`login_${mobile}`];
        if (!record)
            return res.status(400).json({ success: false, message: 'No OTP requested. Please request again.' });
        if (Date.now() > record.expiresAt) {
            delete otpStore[`login_${mobile}`];
            return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
        }
        if (record.otp !== otp.trim())
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });

        delete otpStore[`login_${mobile}`];

        const [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [mobile]);
        const user = users[0];
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, unique_id: user.unique_id, full_name: user.full_name },
            process.env.JWT_SECRET, { expiresIn: '7d' }
        );
        res.json({
            success: true, message: 'OTP verified! Login successful.', token,
            user: { id: user.id, unique_id: user.unique_id, full_name: user.full_name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('verifyLoginOTP error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET PROFILE
const getProfile = async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, unique_id, full_name, email, role, phone, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (users.length === 0)
            return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, user: users[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { register, sendRegisterOTP, verifyRegisterOTP, login, sendLoginOTP, verifyLoginOTP, getProfile };