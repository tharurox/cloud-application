const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const sqlite3 = require('sqlite3').verbose();
const { exec, spawn } = require('child_process');
const flash = require('connect-flash');

const app = express();
const port = 3000;

const ASSEMBLYAI_API_KEY = 'f6ac0ab5e04141dca16baf2571bc8c5a'; // Replace with your AssemblyAI API key

// Set EJS as the template engine
const db = require('./database');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());  // For parsing application/json
app.use(express.urlencoded({ extended: true })); // To parse form data

// Set up session management
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
}));

// Use flash middleware
app.use(flash());

// Initialize SQLite database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        file_name TEXT,
        file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy((username, password, done) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return done(err);
        if (!user) return done(null, false, { message: 'Incorrect username.' });
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return done(err);
            if (isMatch) return done(null, user);
            return done(null, false, { message: 'Incorrect password.' });
        });
    });
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Home page
app.get('/', isAuthenticated, (req, res) => {
    res.render('index');
});

// Register page
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    console.log(username, password);

    // Check if the username or password is missing
    if (!username || !password) {
        return res.status(400).send('Username and password are required.');
    }

    // Hash the password
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).send('Error hashing password');
        }

        // Insert the new user into the database
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function (err) {
            if (err) {
                console.error('Error inserting user into database:', err);
                if (err.code === 'SQLITE_CONSTRAINT') {
                    // This error occurs when the username already exists (unique constraint violation)
                    return res.status(400).send('Username already exists.');
                } else {
                    return res.status(500).send('Error registering user');
                }
            }

            // Registration successful, redirect to login page
            res.redirect('/login');
        });
    });
});

// Login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Use Passport to handle login
app.post('/login',
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true // This now works with connect-flash
    })
);

// Logout route
app.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).send('Error during logout');
        }
        res.redirect('/login');
    });
});

// Handle file upload and transcription
app.post('/upload', upload.single('video'), async (req, res) => {
    const videoPath = req.file.path;
    const audioPath = `uploads/${Date.now()}.mp3`;
    const transcriptionPath = `transcriptions/${Date.now()}.txt`;

    // Extract audio from video
    ffmpeg(videoPath)
        .output(audioPath)
        .on('end', async () => {
            try {
                const transcriptionText = await transcribeAudioWithAssemblyAI(audioPath);
                fs.writeFileSync(transcriptionPath, transcriptionText);

                // Save the transcription file info to the database
                const userId = req.user.id;
                db.run(`INSERT INTO downloads (user_id, file_name, file_path) VALUES (?, ?, ?)`,
                    [userId, path.basename(transcriptionPath), transcriptionPath],
                    (err) => {
                        if (err) {
                            console.error('Error saving file info to database:', err);
                        }
                    });

                res.render('progress', { transcriptionPath });
            } catch (error) {
                console.error('Transcription error:', error);
                res.status(500).send('Transcription failed');
            }
        })
        .on('progress', (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
        })
        .run();
});

// Handle transcription from URL
// Handle transcription from URL
app.post('/transcribe_url', async (req, res) => {
    const text = req.body.text;

    console.log('Received text:', text);

    if (text) {
        // Split the command and arguments for spawn
        const command = 'transcribe-anything';
        const args = [text];
        const childProcess = spawn(command, args);

        let output = '';

        // Capture stdout
        childProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
            output += data.toString();
        });

        // Capture stderr
        childProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            output += `stderr: ${data.toString()}`;
        });

        // Handle process exit
        childProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);

            if (code === 0) {
                const timestamp = Date.now();
                const filename = `transcription_${timestamp}.txt`;
                const filePath = path.join(__dirname, 'transcriptions', filename);

                // Save the transcription output to a text file
                fs.writeFileSync(filePath, output);

                // Send the file as a download to the user
                res.download(filePath, (err) => {
                    if (err) {
                        console.error('Error sending file:', err);
                        res.status(500).send('Error downloading file');
                    }
                });
            } else {
                res.status(500).json({ output: `Process exited with code ${code}` });
            }
        });

        // Handle errors
        childProcess.on('error', (error) => {
            console.error(`child process error: ${error}`);
            res.status(500).json({ output: `Error processing the transcription: ${error.message}` });
        });
    } else {
        res.status(400).json({ output: 'No text provided.' });
    }
});

// Download transcription
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'transcriptions', req.params.filename);
    res.download(filePath);
});

// Route to display download history
app.get('/history', isAuthenticated, (req, res) => {
    const userId = req.user.id;
    db.all(`SELECT * FROM downloads WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, rows) => {
        if (err) {
            console.error('Error fetching download history:', err);
            return res.status(500).send('Error fetching download history');
        }
        res.render('history', { files: rows });
    });
});

// Serve download file
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'transcriptions', req.params.filename);
    res.download(filePath);
});

// Transcribe audio using AssemblyAI
async function transcribeAudioWithAssemblyAI(audioPath) {
    // Upload the audio file to AssemblyAI
    const uploadResponse = await axios({
        method: 'post',
        url: 'https://api.assemblyai.com/v2/upload',
        headers: {
            authorization: ASSEMBLYAI_API_KEY,
            'content-type': 'application/json',
        },
        data: fs.createReadStream(audioPath),
    });

    const audioUrl = uploadResponse.data.upload_url;

    // Request transcription
    const transcriptResponse = await axios({
        method: 'post',
        url: 'https://api.assemblyai.com/v2/transcript',
        headers: {
            authorization: ASSEMBLYAI_API_KEY,
            'content-type': 'application/json',
        },
        data: {
            audio_url: audioUrl,
        },
    });

    const transcriptId = transcriptResponse.data.id;

    // Wait for the transcription to complete
    let transcriptionCompleted = false;
    let transcriptionText = '';
    while (!transcriptionCompleted) {
        const transcriptStatusResponse = await axios({
            method: 'get',
            url: `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
            headers: {
                authorization: ASSEMBLYAI_API_KEY,
            },
        });

        if (transcriptStatusResponse.data.status === 'completed') {
            transcriptionText = transcriptStatusResponse.data.text;
            transcriptionCompleted = true;
        } else if (transcriptStatusResponse.data.status === 'failed') {
            throw new Error('Transcription failed');
        } else {
            // Wait for a few seconds before checking the status again
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    return transcriptionText;
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
