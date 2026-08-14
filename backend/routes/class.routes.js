const express = require('express');
const router = express.Router();
const { verifyToken, isTeacher } = require('../middleware/auth.middleware');
const {
    createClassroom, getTeacherClassrooms, getStudentClassrooms,
    addStudent, removeStudent, getClassroomStudents,
    scheduleClass, getScheduledClasses, startClass, endClass
} = require('../controllers/class.controller');

router.post('/create', verifyToken, isTeacher, createClassroom);
router.get('/teacher', verifyToken, isTeacher, getTeacherClassrooms);
router.get('/student', verifyToken, getStudentClassrooms);
router.post('/add-student', verifyToken, isTeacher, addStudent);
router.post('/remove-student', verifyToken, isTeacher, removeStudent);
router.get('/:classroom_id/students', verifyToken, getClassroomStudents);
router.post('/schedule', verifyToken, isTeacher, scheduleClass);
router.get('/:classroom_id/sessions', verifyToken, getScheduledClasses);
router.put('/session/:session_id/start', verifyToken, isTeacher, startClass);
router.put('/session/:session_id/end', verifyToken, isTeacher, endClass);

module.exports = router;