-- ============================================
-- EduConnect - Virtual Classroom Database
-- ============================================

CREATE DATABASE IF NOT EXISTS educonnect;
USE educonnect;

-- ============================================
-- USERS TABLE (Teachers + Students)
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unique_id VARCHAR(20) NOT NULL UNIQUE,  -- TCH-0001 or STU-0001
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('teacher', 'student') NOT NULL,
    profile_pic VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(15) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- CLASSROOMS TABLE
-- ============================================
CREATE TABLE classrooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_code VARCHAR(10) NOT NULL UNIQUE,  -- e.g. EDU-XY12
    name VARCHAR(150) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    teacher_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- CLASSROOM ENROLLMENTS (Teacher adds/removes students)
-- ============================================
CREATE TABLE enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NOT NULL,
    student_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_enrollment (classroom_id, student_id)
);

-- ============================================
-- SCHEDULED CLASSES (Live Sessions)
-- ============================================
CREATE TABLE scheduled_classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT NULL,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    meeting_link VARCHAR(255) DEFAULT NULL,
    status ENUM('upcoming', 'live', 'completed', 'cancelled') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
);

-- ============================================
-- ATTENDANCE TABLE
-- ============================================
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    student_id INT NOT NULL,
    classroom_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT NULL,
    marked_at TIMESTAMP DEFAULT NULL,       -- Marked after 40 minutes
    duration_minutes INT DEFAULT 0,
    status ENUM('present', 'absent', 'partial') DEFAULT 'absent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES scheduled_classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    UNIQUE KEY unique_attendance (session_id, student_id)
);

-- ============================================
-- NOTES TABLE (Teacher uploads PDFs)
-- ============================================
CREATE TABLE notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NOT NULL,
    teacher_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT DEFAULT 0,               -- in KB
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NOT NULL,
    teacher_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    due_date DATETIME NOT NULL,
    total_marks INT DEFAULT 100,
    attachment_path VARCHAR(500) DEFAULT NULL,  -- Teacher's assignment PDF
    status ENUM('active', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- ASSIGNMENT SUBMISSIONS (Student uploads answers)
-- ============================================
CREATE TABLE submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT DEFAULT 0,
    marks_obtained INT DEFAULT NULL,
    feedback TEXT DEFAULT NULL,
    status ENUM('submitted', 'graded', 'returned') DEFAULT 'submitted',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    graded_at TIMESTAMP DEFAULT NULL,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_submission (assignment_id, student_id)
);

-- ============================================
-- WEEKLY ATTENDANCE REPORTS (sent via n8n)
-- ============================================
CREATE TABLE attendance_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    report_data JSON NOT NULL,             -- Full report as JSON
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('assignment', 'class', 'attendance', 'notes', 'general') DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_unique_id ON users(unique_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_classroom ON enrollments(classroom_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Sample Teacher (password: Teacher@123)
INSERT INTO users (unique_id, full_name, email, password, role) VALUES
('TCH-0001', 'Dr. Rajesh Kumar', 'teacher@educonnect.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher');

-- Sample Students (password: Student@123)
INSERT INTO users (unique_id, full_name, email, password, role) VALUES
('STU-0001', 'Priya Sharma', 'priya@educonnect.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student'),
('STU-0002', 'Arjun Mehta', 'arjun@educonnect.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student'),
('STU-0003', 'Sneha Patel', 'sneha@educonnect.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student');

-- Sample Classroom
INSERT INTO classrooms (classroom_code, name, subject, description, teacher_id) VALUES
('EDU-CS01', 'Computer Science - Batch A', 'Computer Science', 'Advanced CS concepts including DSA, DBMS and Web Development', 1);

-- Enroll students
INSERT INTO enrollments (classroom_id, student_id) VALUES (1, 2), (1, 3), (1, 4);

-- Sample Scheduled Class
INSERT INTO scheduled_classes (classroom_id, title, description, scheduled_date, start_time, end_time, status) VALUES
(1, 'Introduction to SQL Joins', 'We will cover INNER, LEFT, RIGHT and FULL OUTER joins with examples', CURDATE(), '10:00:00', '11:30:00', 'upcoming');

-- ============================================
-- USEFUL VIEWS
-- ============================================

-- View: Student attendance summary per classroom
CREATE VIEW student_attendance_summary AS
SELECT
    u.full_name AS student_name,
    u.unique_id AS student_id,
    c.name AS classroom_name,
    COUNT(sc.id) AS total_classes,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
    SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
    ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(sc.id)) * 100, 2) AS attendance_percentage
FROM users u
JOIN enrollments e ON u.id = e.student_id
JOIN classrooms c ON e.classroom_id = c.id
JOIN scheduled_classes sc ON sc.classroom_id = c.id
LEFT JOIN attendance a ON a.student_id = u.id AND a.session_id = sc.id
WHERE sc.status = 'completed'
GROUP BY u.id, c.id;

-- View: Weekly attendance for n8n reports
CREATE VIEW weekly_attendance AS
SELECT
    u.full_name,
    u.email,
    u.unique_id,
    c.name AS classroom_name,
    sc.scheduled_date,
    sc.title AS session_title,
    COALESCE(a.status, 'absent') AS attendance_status,
    a.duration_minutes
FROM users u
JOIN enrollments e ON u.id = e.student_id
JOIN classrooms c ON e.classroom_id = c.id
JOIN scheduled_classes sc ON sc.classroom_id = c.id
LEFT JOIN attendance a ON a.student_id = u.id AND a.session_id = sc.id
WHERE sc.scheduled_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  AND sc.status = 'completed'
ORDER BY sc.scheduled_date DESC;