const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// =============================================
// API ROUTES
// =============================================
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/classes', require('./routes/class.routes'));
app.use('/api/notes', require('./routes/notes.routes'));
app.use('/api/assignments', require('./routes/assignment.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));

// Notifications route (inline)
const db = require('./config/db');
const { verifyToken } = require('./middleware/auth.middleware');

app.get('/api/notifications', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [req.user.id]
        );
        res.json({ success: true, notifications: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.put('/api/notifications/read', verifyToken, async (req, res) => {
    try {
        await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// =============================================
// SOCKET.IO
// =============================================
require('./socket')(io);

// =============================================
// FRONTEND ROUTES (catch all)
// =============================================
// ============================================

const fs = require('fs');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html'));
});

app.get('/teacher-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'teacher-dashboard.html'));
});

app.get('/student-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'student-dashboard.html'));
});

app.get('/classroom.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'classroom.html'));
});

app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});


// =============================================
// START SERVER
// =============================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n🚀 EduConnect Server running on http://localhost:${PORT}`);
    console.log(`📚 Frontend: http://localhost:${PORT}`);
    console.log(`🔌 Socket.io: Ready for real-time connections`);
    console.log(`🗄️  Database: MySQL on localhost\n`);
});