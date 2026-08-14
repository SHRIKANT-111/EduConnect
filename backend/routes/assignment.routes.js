const express = require('express');
const router = express.Router();
const { verifyToken, isTeacher } = require('../middleware/auth.middleware');
const { uploadAssignment, uploadSubmission } = require('../middleware/upload.middleware');
const { createAssignment, getAssignments, submitAssignment, getSubmissions, gradeSubmission, downloadSubmission } = require('../controllers/assignment.controller');

router.post('/create', verifyToken, isTeacher, uploadAssignment.single('pdf'), createAssignment);
router.get('/:classroom_id', verifyToken, getAssignments);
router.post('/submit', verifyToken, uploadSubmission.single('pdf'), submitAssignment);
router.get('/:assignment_id/submissions', verifyToken, isTeacher, getSubmissions);
router.put('/submissions/:submission_id/grade', verifyToken, isTeacher, gradeSubmission);
router.get('/submissions/:submission_id/download', verifyToken, isTeacher, downloadSubmission);

module.exports = router;