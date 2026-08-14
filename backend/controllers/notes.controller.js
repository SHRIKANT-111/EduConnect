const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// UPLOAD NOTE
const uploadNote = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'PDF file is required.' });
        const { classroom_id, title, description } = req.body;
        if (!classroom_id || !title) return res.status(400).json({ success: false, message: 'Classroom and title required.' });

        const fileSizeKB = Math.round(req.file.size / 1024);
        await db.execute(
            'INSERT INTO notes (classroom_id, teacher_id, title, description, file_name, file_path, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [classroom_id, req.user.id, title, description || null, req.file.originalname, req.file.filename, fileSizeKB]
        );

        // Notify enrolled students
        const [students] = await db.execute('SELECT student_id FROM enrollments WHERE classroom_id = ? AND is_active = 1', [classroom_id]);
        for (const s of students) {
            await db.execute(
                'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                [s.student_id, 'New Notes Available', `New notes "${title}" have been uploaded.`, 'notes']
            );
        }

        res.status(201).json({ success: true, message: 'Notes uploaded successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET NOTES FOR CLASSROOM
const getNotes = async (req, res) => {
    try {
        const { classroom_id } = req.params;
        const [rows] = await db.execute(
            `SELECT n.*, u.full_name as uploaded_by FROM notes n
             JOIN users u ON n.teacher_id = u.id
             WHERE n.classroom_id = ? ORDER BY n.created_at DESC`,
            [classroom_id]
        );
        res.json({ success: true, notes: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// DOWNLOAD NOTE
const downloadNote = async (req, res) => {
    try {
        const { note_id } = req.params;
        const [notes] = await db.execute('SELECT * FROM notes WHERE id = ?', [note_id]);
        if (notes.length === 0) return res.status(404).json({ success: false, message: 'Note not found.' });

        const note = notes[0];
        const filePath = path.join(__dirname, '../uploads/notes', note.file_path);

        if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File not found on server.' });

        // Increment download count
        await db.execute('UPDATE notes SET download_count = download_count + 1 WHERE id = ?', [note_id]);

        res.download(filePath, note.file_name);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// DELETE NOTE (teacher only)
const deleteNote = async (req, res) => {
    try {
        const { note_id } = req.params;
        const [notes] = await db.execute('SELECT * FROM notes WHERE id = ? AND teacher_id = ?', [note_id, req.user.id]);
        if (notes.length === 0) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const filePath = path.join(__dirname, '../uploads/notes', notes[0].file_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await db.execute('DELETE FROM notes WHERE id = ?', [note_id]);
        res.json({ success: true, message: 'Note deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { uploadNote, getNotes, downloadNote, deleteNote };