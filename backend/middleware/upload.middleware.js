const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const createDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Storage for Notes
const notesStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/notes');
        createDir(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `note_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Storage for Assignments (teacher question paper)
const assignmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/assignments');
        createDir(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `assignment_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Storage for Submissions (student answers)
const submissionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/submissions');
        createDir(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `submission_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter - PDFs only
const pdfFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed!'), false);
    }
};

const uploadNote = multer({
    storage: notesStorage,
    fileFilter: pdfFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

const uploadAssignment = multer({
    storage: assignmentStorage,
    fileFilter: pdfFilter,
    limits: { fileSize: 20 * 1024 * 1024 }
});

const uploadSubmission = multer({
    storage: submissionStorage,
    fileFilter: pdfFilter,
    limits: { fileSize: 20 * 1024 * 1024 }
});

module.exports = { uploadNote, uploadAssignment, uploadSubmission };