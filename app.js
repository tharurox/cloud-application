const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const session = require('express-session');
const { CognitoUserPool, CognitoUserAttribute, CognitoUser, AuthenticationDetails } = require('amazon-cognito-identity-js');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const flash = require('connect-flash');

const app = express();
const port = 3000;

// AWS Cognito Pool Info
const poolData = {
    UserPoolId: 'ap-southeast-2_Up85TT9kx', // Replace with your User Pool ID
    ClientId: '3jlv0og5l1mkjnq1tdb7bg3ini'  // Replace with your App Client ID
};
const userPool = new CognitoUserPool(poolData);

AWS.config.update({
    region: 'ap-southeast-2'
});

const ASSEMBLYAI_API_KEY = 'f6ac0ab5e04141dca16baf2571bc8c5a'; // Replace with your AssemblyAI API key

// Set EJS as the template engine
const db = require('./config/database');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up session management
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
}));

// Use flash middleware
app.use(flash());

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// Function to handle AWS Cognito login
function cognitoLogin(username, password, req, res) {
    const authDetails = new AuthenticationDetails({
        Username: username,
        Password: password
    });

    const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool
    });

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: (result) => {
            const idToken = result.getIdToken().getJwtToken();
            req.session.user = jwt.decode(idToken);
            res.redirect('/');
        },
        onFailure: (err) => {
            req.flash('error_msg', 'Authentication failed. Please try again.');
            res.redirect('/login');
        }
    });
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

// Handle user registration POST request
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Validate form input
    if (!username || !password) {
        req.flash('error_msg', 'Username and password are required.');
        return res.redirect('/register');
    }

    // Create CognitoUserAttributes
    const attributeList = [];
    const emailAttribute = new CognitoUserAttribute({
        Name: 'email',
        Value: username, // Assuming username is the email, adjust if needed
    });
    attributeList.push(emailAttribute);

    // Call AWS Cognito signUp method to register the user
    userPool.signUp(username, password, attributeList, null, (err, data) => {
        if (err) {
            req.flash('error_msg', `Error registering user: ${err.message}`);
            return res.redirect('/register');
        }

        // Save username in session for verification step
        req.session.username = username;
        req.flash('success_msg', 'Registration successful! Please verify your account.');
        
        // Redirect to verify page after registration success
        res.redirect('/verify');
    });
});

// Verify page
app.get('/verify', (req, res) => {
    if (!req.session.username) {
        req.flash('error_msg', 'You need to register first.');
        return res.redirect('/register');
    }
    res.render('verify', { username: req.session.username });
});

// Handle verification code submission
app.post('/verify', (req, res) => {
    const { username } = req.session;
    const { verificationCode } = req.body;

    const userData = {
        Username: username,
        Pool: userPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.confirmRegistration(verificationCode, true, (err, result) => {
        if (err) {
            req.flash('error_msg', `Verification failed: ${err.message}`);
            return res.redirect('/verify');
        }

        req.flash('success_msg', 'Your account has been verified! You can now log in.');
        res.redirect('/login');
    });
});

// Login page
app.get('/login', (req, res) => {
    res.render('login');
});


// AWS Cognito Login handler
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        req.flash('error_msg', 'Username and password are required.');
        return res.redirect('/login');
    }

    const authDetails = new AuthenticationDetails({
        Username: username,
        Password: password
    });

    const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool
    });

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: (result) => {
            const idToken = result.getIdToken().getJwtToken();
            req.session.user = jwt.decode(idToken);
            res.redirect('/');
        },
        onFailure: (err) => {
            console.log('Cognito Authentication Error: ', err);  // Log the actual error
            if (err.code === 'UserNotConfirmedException') {
                req.flash('error_msg', 'Account not verified. Please check your email for the verification code.');
                return res.redirect('/verify'); // Redirect to verify page
            } else if (err.code === 'NotAuthorizedException') {
                req.flash('error_msg', 'Incorrect username or password.');
            } else {
                req.flash('error_msg', `Authentication failed: ${err.message}`);
            }
            res.redirect('/login');
        }
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
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

    ffmpeg(videoPath)
        .output(audioPath)
        .on('end', async () => {
            try {
                const transcriptionText = await transcribeAudioWithAssemblyAI(audioPath);
                fs.writeFileSync(transcriptionPath, transcriptionText);

                // Save the transcription file info to the database
                const userId = req.session.user.sub;
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
app.post('/transcribe_url', isAuthenticated, async (req, res) => {
    const text = req.body.text;

    console.log('Received text:', text);

    if (text) {
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
            if (code === 0) {
                const timestamp = Date.now();
                const filename = `transcription_${timestamp}.txt`;
                const filePath = path.join(__dirname, 'transcriptions', filename);

                fs.writeFileSync(filePath, output);

                const userId = req.session.user.sub;
                db.run(`INSERT INTO downloads (user_id, file_name, file_path, source_url) VALUES (?, ?, ?, ?)`,
                    [userId, filename, filePath, text],
                    (err) => {
                        if (err) {
                            console.error('Error saving file info to database:', err);
                        }
                    });

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

// Display download history
app.get('/history', isAuthenticated, (req, res) => {
    const userId = req.session.user.sub;
    db.all(`SELECT * FROM downloads WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, rows) => {
        if (err) {
            console.error('Error fetching download history:', err);
            return res.status(500).send('Error fetching download history');
        }
        res.render('history', { files: rows });
    });
});

// Transcribe audio using AssemblyAI
async function transcribeAudioWithAssemblyAI(audioPath) {
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
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    return transcriptionText;
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});