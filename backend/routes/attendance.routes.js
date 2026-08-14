const express = require('express');
const router = express.Router();
const { verifyToken, isTeacher } = require('../middleware/auth.middleware');
const { studentJoined, markPresent, getSessionAttendance, getStudentAttendance, sendWeeklyReport } = require('../controllers/attendance.controller');

router.post('/join', verifyToken, studentJoined);
router.post('/mark-present', verifyToken, markPresent);
router.get('/session/:session_id', verifyToken, getSessionAttendance);
router.get('/student/:classroom_id', verifyToken, getStudentAttendance);
router.post('/weekly-report', verifyToken, isTeacher, sendWeeklyReport);

module.exports = router;