// ===== routes/notes.routes.js =====
const express = require('express');
const router = express.Router();
const { verifyToken, isTeacher } = require('../middleware/auth.middleware');
const { uploadNote: uploadNoteMiddleware } = require('../middleware/upload.middleware');
const { uploadNote, getNotes, downloadNote, deleteNote } = require('../controllers/notes.controller');

router.post('/upload', verifyToken, isTeacher, uploadNoteMiddleware.single('pdf'), uploadNote);
router.get('/:classroom_id', verifyToken, getNotes);
router.get('/download/:note_id', verifyToken, downloadNote);
router.delete('/:note_id', verifyToken, isTeacher, deleteNote);

module.exports = router;