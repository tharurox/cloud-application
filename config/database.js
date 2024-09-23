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

// Create the users table if it does not exist
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
  )
`, (err, results) => {
  if (err) {
    console.error('Error creating users table:', err);
  }
});

// Create the downloads table if it does not exist
pool.query(`
  CREATE TABLE IF NOT EXISTS downloads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    file_name VARCHAR(255),
    file_path VARCHAR(255),
    source_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`, (err, results) => {
  if (err) {
    console.error('Error creating downloads table:', err);
  }
});

// Check for the existence of the source_url column and add it if it doesn't exist
pool.query(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'downloads' AND COLUMN_NAME = 'source_url';
`, (err, results) => {
  if (err) {
    console.error('Error fetching table info:', err.message);
    return;
  }

  // If source_url column does not exist, add it
  if (results.length === 0) {
    pool.query(`ALTER TABLE downloads ADD COLUMN source_url VARCHAR(255)`, (err) => {
      if (err) {
        console.error('Error adding source_url column:', err.message);
      } else {
        console.log('Added source_url column to downloads table');
      }
    });
  }
});

module.exports = pool;