const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('app.db'); // Persist the database on disk

db.serialize(() => {
    // Create users table if it does not exist
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // Create downloads table if it does not exist
    db.run(`CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        file_name TEXT,
        file_path TEXT,
        source_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error('Error creating downloads table:', err.message);
        }
    });

    // Add source_url column if it does not exist
    db.run(`PRAGMA table_info(downloads)`, (err, columns) => {
        if (err) {
            console.error('Error fetching table info:', err.message);
            return;
        }
        
        const hasSourceUrl = columns.some(col => col.name === 'source_url');
        if (!hasSourceUrl) {
            db.run(`ALTER TABLE downloads ADD COLUMN source_url TEXT`, (err) => {
                if (err) {
                    console.error('Error adding source_url column:', err.message);
                } else {
                    console.log('Added source_url column to downloads table');
                }
            });
        }
    });
});

module.exports = db;