const db = require('../config/db');
const axios = require('axios');
require('dotenv').config();

// MARK STUDENT JOINED (called when student joins live class)
const studentJoined = async (req, res) => {
    try {
        const { session_id } = req.body;
        const student_id = req.user.id;

        const [session] = await db.execute('SELECT * FROM scheduled_classes WHERE id = ? AND status = "live"', [session_id]);
        if (session.length === 0) return res.status(404).json({ success: false, message: 'No live class found.' });

        await db.execute(
            `INSERT INTO attendance (session_id, student_id, classroom_id, joined_at, status)
             VALUES (?, ?, ?, NOW(), 'partial')
             ON DUPLICATE KEY UPDATE joined_at = COALESCE(joined_at, NOW())`,
            [session_id, student_id, session[0].classroom_id]
        );

        res.json({ success: true, message: 'Joined class recorded.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// MARK ATTENDANCE PRESENT (called after 40 minutes)
const markPresent = async (req, res) => {
    try {
        const { session_id } = req.body;
        const student_id = req.user.id;

        const [session] = await db.execute(
            'SELECT * FROM scheduled_classes WHERE id = ?',
            [session_id]
        );
        if (session.length === 0) 
            return res.status(404).json({ success: false, message: 'Session not found.' });

        const [existing] = await db.execute(
            'SELECT * FROM attendance WHERE session_id = ? AND student_id = ?',
            [session_id, student_id]
        );

        if (existing.length === 0) {
            // No record — create and mark present
            await db.execute(
                `INSERT INTO attendance 
                 (session_id, student_id, classroom_id, joined_at, status, marked_at, duration_minutes)
                 VALUES (?, ?, ?, NOW(), 'present', NOW(), 40)`,
                [session_id, student_id, session[0].classroom_id]
            );
        } else {
            // Record exists — update to present
            await db.execute(
                `UPDATE attendance 
                 SET status = 'present', marked_at = NOW(), duration_minutes = 40
                 WHERE session_id = ? AND student_id = ?`,
                [session_id, student_id]
            );
        }

        res.json({ success: true, message: 'Attendance marked as present!' });
    } catch (err) {
        console.error('markPresent error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET ATTENDANCE FOR SESSION
const getSessionAttendance = async (req, res) => {
    try {
        const { session_id } = req.params;
        const [rows] = await db.execute(
            `SELECT a.*, u.full_name, u.unique_id, u.email
             FROM attendance a JOIN users u ON a.student_id = u.id
             WHERE a.session_id = ? ORDER BY u.full_name`,
            [session_id]
        );
        res.json({ success: true, attendance: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET STUDENT ATTENDANCE SUMMARY
const getStudentAttendance = async (req, res) => {
    try {
        const { classroom_id } = req.params;
        const student_id = req.user.id;

        const [rows] = await db.execute(
            `SELECT sc.title, sc.scheduled_date, sc.start_time,
             COALESCE(a.status, 'absent') as status, a.duration_minutes, a.marked_at
             FROM scheduled_classes sc
             LEFT JOIN attendance a ON a.session_id = sc.id AND a.student_id = ?
             WHERE sc.classroom_id = ? AND sc.status = 'completed'
             ORDER BY sc.scheduled_date DESC`,
            [student_id, classroom_id]
        );

        const total = rows.length;
        const present = rows.filter(r => r.status === 'present').length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        res.json({ success: true, records: rows, summary: { total, present, absent: total - present, percentage } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// SEND WEEKLY ATTENDANCE REPORT via n8n
const sendWeeklyReport = async (req, res) => {
    try {
        const { classroom_id } = req.body;

        const [classroom] = await db.execute('SELECT * FROM classrooms WHERE id = ? AND teacher_id = ?', [classroom_id, req.user.id]);
        if (classroom.length === 0) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const [reportData] = await db.execute(
            `SELECT u.full_name, u.email, u.unique_id,
             COUNT(sc.id) as total_classes,
             SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
             ROUND(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(sc.id) * 100, 1) as percentage
             FROM users u
             JOIN enrollments e ON u.id = e.student_id
             JOIN scheduled_classes sc ON sc.classroom_id = e.classroom_id
             LEFT JOIN attendance a ON a.student_id = u.id AND a.session_id = sc.id
             WHERE e.classroom_id = ? AND e.is_active = 1
             AND sc.scheduled_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             AND sc.status = 'completed'
             GROUP BY u.id`,
            [classroom_id]
        );

        const payload = {
            classroom_name: classroom[0].name,
            teacher_name: req.user.full_name,
            week_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            week_end: new Date().toISOString().split('T')[0],
            report: reportData
        };

        // Send to n8n webhook
        try {
            await axios.post(process.env.N8N_WEBHOOK_URL, payload);
        } catch (webhookErr) {
            console.error('n8n webhook failed:', webhookErr.message);
        }

        // Save report to DB
        await db.execute(
            'INSERT INTO attendance_reports (classroom_id, week_start, week_end, report_data) VALUES (?, ?, ?, ?)',
            [classroom_id, payload.week_start, payload.week_end, JSON.stringify(reportData)]
        );

        res.json({ success: true, message: 'Weekly report sent via n8n!', report: reportData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { studentJoined, markPresent, getSessionAttendance, getStudentAttendance, sendWeeklyReport };