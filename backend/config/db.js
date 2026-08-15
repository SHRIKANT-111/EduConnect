const mysql = require('mysql2');
const fs = require('fs');
require('dotenv').config();

const caPath = process.env.DB_SSL_CA || 'C:/Users/lenovo/Downloads/ca.pem';
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        ca: fs.readFileSync(caPath)
    }
});

const promisePool = pool.promise();

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ MySQL Database connected successfully!');
        connection.release();
    }
});

module.exports = promisePool;