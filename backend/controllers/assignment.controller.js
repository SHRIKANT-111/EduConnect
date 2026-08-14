const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// CREATE ASSIGNMENT
const createAssignment = async (req, res) => {
    try {
        const { classroom_id, title, description, due_date, total_marks } = req.body;
        if (!classroom_id || !title || !description || !due_date) {
            return res.status(400).json({ success: false, message: 'All fields required.' });
        }

        const attachmentPath = req.file ? req.file.filename : null;

        const [result] = await db.execute(
            'INSERT INTO assignments (classroom_id, teacher_id, title, description, due_date, total_marks, attachment_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [classroom_id, req.user.id, title, description, due_date, total_marks || 100, attachmentPath]
        );

        // Notify students
        const [students] = await db.execute('SELECT student_id FROM enrollments WHERE classroom_id = ? AND is_active = 1', [classroom_id]);
        for (const s of students) {
            await db.execute(
                'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                [s.student_id, 'New Assignment', `New assignment "${title}" due on ${due_date}.`, 'assignment']
            );
        }

        res.status(201).json({ success: true, message: 'Assignment created!', assignment_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET ASSIGNMENTS (for classroom)
const getAssignments = async (req, res) => {
    try {
        const { classroom_id } = req.params;
        const [rows] = await db.execute(
            `SELECT a.*, u.full_name as teacher_name,
             (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as submission_count
             FROM assignments a JOIN users u ON a.teacher_id = u.id
             WHERE a.classroom_id = ? ORDER BY a.created_at DESC`,
            [classroom_id]
        );
        res.json({ success: true, assignments: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// SUBMIT ASSIGNMENT (student)
const submitAssignment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'PDF file required.' });
        const { assignment_id } = req.body;

        const [assignment] = await db.execute('SELECT * FROM assignments WHERE id = ? AND status = "active"', [assignment_id]);
        if (assignment.length === 0) return res.status(404).json({ success: false, message: 'Assignment not found or closed.' });

        if (new Date() > new Date(assignment[0].due_date)) {
            return res.status(400).json({ success: false, message: 'Submission deadline has passed.' });
        }

        const fileSizeKB = Math.round(req.file.size / 1024);

        await db.execute(
            `INSERT INTO submissions (assignment_id, student_id, file_name, file_path, file_size)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), file_path = VALUES(file_path), file_size = VALUES(file_size), submitted_at = NOW()`,
            [assignment_id, req.user.id, req.file.originalname, req.file.filename, fileSizeKB]
        );

        res.json({ success: true, message: 'Assignment submitted successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET SUBMISSIONS (teacher views student submissions)
const getSubmissions = async (req, res) => {
    try {
        const { assignment_id } = req.params;
        const [rows] = await db.execute(
            `SELECT s.*, u.full_name, u.unique_id, u.email
             FROM submissions s JOIN users u ON s.student_id = u.id
             WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC`,
            [assignment_id]
        );
        res.json({ success: true, submissions: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GRADE SUBMISSION
const gradeSubmission = async (req, res) => {
    try {
        const { submission_id } = req.params;
        const { marks_obtained, feedback } = req.body;

        await db.execute(
            'UPDATE submissions SET marks_obtained = ?, feedback = ?, status = "graded", graded_at = NOW() WHERE id = ?',
            [marks_obtained, feedback || null, submission_id]
        );

        // Notify student
        const [sub] = await db.execute('SELECT student_id, assignment_id FROM submissions WHERE id = ?', [submission_id]);
        if (sub.length > 0) {
            await db.execute(
                'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                [sub[0].student_id, 'Assignment Graded', `Your assignment has been graded. Marks: ${marks_obtained}`, 'assignment']
            );
        }

        res.json({ success: true, message: 'Submission graded!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// DOWNLOAD SUBMISSION
const downloadSubmission = async (req, res) => {
    try {
        const { submission_id } = req.params;
        const [subs] = await db.execute('SELECT * FROM submissions WHERE id = ?', [submission_id]);
        if (subs.length === 0) return res.status(404).json({ success: false, message: 'Submission not found.' });

        const filePath = path.join(__dirname, '../uploads/submissions', subs[0].file_path);
        if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File not found.' });

        res.download(filePath, subs[0].file_name);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { createAssignment, getAssignments, submitAssignment, getSubmissions, gradeSubmission, downloadSubmission };