const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
};

const isTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: 'Access denied. Teachers only.' });
    }
    next();
};

const isStudent = (req, res, next) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Access denied. Students only.' });
    }
    next();
};

module.exports = { verifyToken, isTeacher, isStudent };