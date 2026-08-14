const db = require('../config/db');

// Generate classroom code e.g. EDU-AB12
const generateClassCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'EDU-';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

// CREATE CLASSROOM
const createClassroom = async (req, res) => {
    try {
        const { name, subject, description } = req.body;
        if (!name || !subject) return res.status(400).json({ success: false, message: 'Name and subject are required.' });

        let code;
        let exists = true;
        while (exists) {
            code = generateClassCode();
            const [rows] = await db.execute('SELECT id FROM classrooms WHERE classroom_code = ?', [code]);
            exists = rows.length > 0;
        }

        const [result] = await db.execute(
            'INSERT INTO classrooms (classroom_code, name, subject, description, teacher_id) VALUES (?, ?, ?, ?, ?)',
            [code, name, subject, description || null, req.user.id]
        );

        res.status(201).json({ success: true, message: 'Classroom created!', classroom_id: result.insertId, code });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET ALL CLASSROOMS FOR TEACHER
const getTeacherClassrooms = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT c.*, COUNT(DISTINCT e.student_id) as student_count
             FROM classrooms c
             LEFT JOIN enrollments e ON c.id = e.classroom_id AND e.is_active = 1
             WHERE c.teacher_id = ? AND c.is_active = 1
             GROUP BY c.id ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, classrooms: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET ALL CLASSROOMS FOR STUDENT
const getStudentClassrooms = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT c.*, u.full_name as teacher_name, u.unique_id as teacher_uid
             FROM classrooms c
             JOIN enrollments e ON c.id = e.classroom_id
             JOIN users u ON c.teacher_id = u.id
             WHERE e.student_id = ? AND e.is_active = 1 AND c.is_active = 1
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, classrooms: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ADD STUDENT TO CLASSROOM
const addStudent = async (req, res) => {
    try {
        const { classroom_id, student_email } = req.body;

        const [classroom] = await db.execute('SELECT id FROM classrooms WHERE id = ? AND teacher_id = ?', [classroom_id, req.user.id]);
        if (classroom.length === 0) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const [student] = await db.execute('SELECT id, full_name, unique_id FROM users WHERE email = ? AND role = "student"', [student_email]);
        if (student.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });

        await db.execute(
            'INSERT INTO enrollments (classroom_id, student_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE is_active = 1',
            [classroom_id, student[0].id]
        );

        res.json({ success: true, message: `${student[0].full_name} added successfully!`, student: student[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// REMOVE STUDENT FROM CLASSROOM
const removeStudent = async (req, res) => {
    try {
        const { classroom_id, student_id } = req.body;

        const [classroom] = await db.execute('SELECT id FROM classrooms WHERE id = ? AND teacher_id = ?', [classroom_id, req.user.id]);
        if (classroom.length === 0) return res.status(403).json({ success: false, message: 'Not authorized.' });

        await db.execute('UPDATE enrollments SET is_active = 0 WHERE classroom_id = ? AND student_id = ?', [classroom_id, student_id]);
        res.json({ success: true, message: 'Student removed from classroom.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET STUDENTS IN CLASSROOM
const getClassroomStudents = async (req, res) => {
    try {
        const { classroom_id } = req.params;
        const [rows] = await db.execute(
            `SELECT u.id, u.unique_id, u.full_name, u.email, u.phone, e.enrolled_at
             FROM users u JOIN enrollments e ON u.id = e.student_id
             WHERE e.classroom_id = ? AND e.is_active = 1 ORDER BY u.full_name`,
            [classroom_id]
        );
        res.json({ success: true, students: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// SCHEDULE CLASS
const scheduleClass = async (req, res) => {
    try {
        const { classroom_id, title, description, scheduled_date, start_time, end_time } = req.body;

        const [classroom] = await db.execute('SELECT id FROM classrooms WHERE id = ? AND teacher_id = ?', [classroom_id, req.user.id]);
        if (classroom.length === 0) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const [result] = await db.execute(
            'INSERT INTO scheduled_classes (classroom_id, title, description, scheduled_date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
            [classroom_id, title, description || null, scheduled_date, start_time, end_time]
        );

        res.status(201).json({ success: true, message: 'Class scheduled successfully!', session_id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// GET SCHEDULED CLASSES
const getScheduledClasses = async (req, res) => {
    try {
        const { classroom_id } = req.params;
        const [rows] = await db.execute(
            `SELECT sc.*, 
             (SELECT COUNT(*) FROM attendance a WHERE a.session_id = sc.id AND a.status = 'present') as present_count
             FROM scheduled_classes sc
             WHERE sc.classroom_id = ?
             ORDER BY sc.scheduled_date DESC, sc.start_time DESC`,
            [classroom_id]
        );
        res.json({ success: true, classes: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// START LIVE CLASS
const startClass = async (req, res) => {
    try {
        const { session_id } = req.params;
        await db.execute('UPDATE scheduled_classes SET status = "live" WHERE id = ? ', [session_id]);
        res.json({ success: true, message: 'Class is now live!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// END LIVE CLASS
const endClass = async (req, res) => {
    try {
        const { session_id } = req.params;

        // Mark absent for enrolled students who didn't attend
        const [session] = await db.execute('SELECT classroom_id FROM scheduled_classes WHERE id = ?', [session_id]);
        if (session.length > 0) {
            await db.execute(
                `INSERT IGNORE INTO attendance (session_id, student_id, classroom_id, status)
                 SELECT ?, e.student_id, ?, 'absent'
                 FROM enrollments e WHERE e.classroom_id = ? AND e.is_active = 1`,
                [session_id, session[0].classroom_id, session[0].classroom_id]
            );
        }

        await db.execute('UPDATE scheduled_classes SET status = "completed" WHERE id = ?', [session_id]);
        res.json({ success: true, message: 'Class ended. Attendance finalized.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { createClassroom, getTeacherClassrooms, getStudentClassrooms, addStudent, removeStudent, getClassroomStudents, scheduleClass, getScheduledClasses, startClass, endClass };