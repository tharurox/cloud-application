const mysql = require('mysql2');
require('dotenv').config();

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'n11849622-assignment2.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com', // AWS RDS MySQL endpoint
  user: process.env.DB_USER || 'admin', // MySQL username
  password: process.env.DB_PASS || 'admin1234', // MySQL password
  database: process.env.DB_NAME || 'videotranscorder', // Database name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL');
    connection.release();
  }
});

// Drop existing tables if they exist
pool.query(`DROP TABLE IF EXISTS downloads`, (err) => {
  if (err) {
    console.error('Error dropping downloads table:', err);
  } else {
    console.log('downloads table dropped.');
  }
});

pool.query(`DROP TABLE IF EXISTS users`, (err) => {
  if (err) {
    console.error('Error dropping users table:', err);
  } else {
    console.log('users table dropped.');
  }
});

// Create the users table
pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('users table created.');
    }
  });

// Create the downloads table
pool.query(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      file_name VARCHAR(255),
      file_path VARCHAR(255),
      source_url VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating downloads table:', err);
    } else {
      console.log('downloads table created.');
    }
  });

module.exports = pool;
