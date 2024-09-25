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
const { spawn } = require('child_process');
const db = require('./config/database'); // Using MySQL from config/database.js

const app = express();
const port = 3000;

// AWS Cognito Pool Info
const poolData = {
    UserPoolId: 'ap-southeast-2_Up85TT9kx',
    ClientId: '3jlv0og5l1mkjnq1tdb7bg3ini'
};
const userPool = new CognitoUserPool(poolData);

AWS.config.update({
    region: 'ap-southeast-2'
});

const { v4: uuidv4 } = require('uuid'); // For unique file names

// Set up S3 with your credentials and region
const s3 = new AWS.S3({
    accessKeyId: 'ASIA5DYSEEJ45XQNPEI4', // Use your AWS access key here
    secretAccessKey: 'vlqiaLPOLeMVScFQGn98mIDSu7ZnJNph1hnDdBbf', // Use your AWS secret key here
    region: 'ap-southeast-2' // The region where your bucket is located
});

const ASSEMBLYAI_API_KEY = 'f6ac0ab5e04141dca16baf2571bc8c5a'; // Replace with your AssemblyAI API key

// Set EJS as the template engine
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
            req.flash('error_msg', `Authentication failed: ${err.message}`);
            res.redirect('/login');
        },
        newPasswordRequired: (userAttributes, requiredAttributes, session) => {
            req.session.userAttributes = userAttributes;
            req.session.requiredAttributes = requiredAttributes;
            req.session.cognitoSession = session;
            req.session.username = username;
            req.session.password = password;
            req.flash('success_msg', 'You need to change your password.');
            res.redirect('/change-password');
        }
    });
}

app.get('/change-password', (req, res) => {
    if (!req.session.username || !req.session.cognitoSession) {
        req.flash('error_msg', 'Invalid session. Please log in again.');
        return res.redirect('/login');
    }
    res.render('change-password', { username: req.session.username });
});

app.post('/change-password', (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword) {
        req.flash('error_msg', 'New password is required.');
        return res.redirect('/change-password');
    }

    const cognitoUser = new CognitoUser({
        Username: req.session.username,
        Pool: userPool
    });

    cognitoUser.completeNewPasswordChallenge(newPassword, req.session.userAttributes, {
        onSuccess: (result) => {
            const idToken = result.getIdToken().getJwtToken();
            req.session.user = jwt.decode(idToken);
            req.flash('success_msg', 'Password changed successfully! You are now logged in.');
            res.redirect('/');
        },
        onFailure: (err) => {
            req.flash('error_msg', `Password change failed: ${err.message}`);
            res.redirect('/change-password');
        }
    });
});

// Multer for file uploads
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

    if (!username || !password) {
        req.flash('error_msg', 'Username and password are required.');
        return res.redirect('/register');
    }

    const attributeList = [];
    const emailAttribute = new CognitoUserAttribute({
        Name: 'email',
        Value: username,
    });
    attributeList.push(emailAttribute);

    userPool.signUp(username, password, attributeList, null, (err, data) => {
        if (err) {
            req.flash('error_msg', `Error registering user: ${err.message}`);
            return res.redirect('/register');
        }

        // If the user is successfully registered in Cognito
        const userId = data.userSub; // This is the Cognito User Sub (UUID)
        
        // Insert user into the MySQL database
        const query = `INSERT INTO users (id, username, password) VALUES (?, ?, ?)`;
        db.query(query, [userId, username, password], (dbErr) => {
            if (dbErr) {
                console.error('Error inserting user into MySQL:', dbErr);
                req.flash('error_msg', 'Error registering user in database.');
                return res.redirect('/register');
            }

            req.session.username = username;
            req.session.userId = userId; // Save the Cognito user ID in the session
            res.redirect('/verify');
        });
    });
});


// Verification page
app.get('/verify', (req, res) => {
    const username = req.session.username;

    if (!username) {
        req.flash('error_msg', 'Username not found. Please register again.');
        return res.redirect('/register');
    }

    res.render('verify', { username });
});

// Handle user verification
app.post('/verify', (req, res) => {
    const { code } = req.body;
    const username = req.session.username;

    if (!username || !code) {
        req.flash('error_msg', 'Invalid verification details.');
        return res.redirect('/verify');
    }

    const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool
    });

    cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
            req.flash('error_msg', `Verification failed: ${err.message}`);
            return res.redirect('/verify');
        }
        req.flash('success_msg', 'Account verified successfully! Please log in.');
        res.redirect('/login');
    });
});

// Login page
app.get('/login', (req, res) => {
    res.render('login');
});
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Temporary hard-coded admin login
    if (username === 'admin' && password === 'admin') {
        req.session.user = { username: 'admin', role: 'admin' }; // You can store other info if needed
        return res.redirect('/');
    }

    // If not hardcoded admin login, continue with Cognito login
    if (!username || !password) {
        req.flash('error_msg', 'Username and password are required.');
        return res.redirect('/login');
    }

    cognitoLogin(username, password, req, res);
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
app.post('/upload', upload.single('video'), async (req, res) => {
    console.log('File upload details:', req.file); // Log the file info

    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    const videoPath = req.file.path; // Local file path
    const bucketName = 'n11849622-assignment-2'; // Your S3 bucket name
    const videoFileName = path.basename(videoPath); // Extract the file name
    const s3VideoKey = `videos/${uuidv4()}-${videoFileName}`; // Unique file name for S3

    console.log('Uploaded video path (local):', videoPath);

    // Generate a presigned URL for the video upload
    const presignedVideoUrl = s3.getSignedUrl('putObject', {
        Bucket: bucketName,
        Key: s3VideoKey,
        Expires: 60 * 5, // 5 minutes expiration time
        ContentType: req.file.mimetype, // Ensure correct MIME type
    });

    try {
        // Upload the video file to S3 using the presigned URL
        const videoUploadResponse = await axios.put(presignedVideoUrl, fs.createReadStream(videoPath), {
            headers: {
                'Content-Type': req.file.mimetype,
            },
        });
        console.log('Video file uploaded to S3:', videoUploadResponse.status);

        // Now, process the file with ffmpeg and transcribe
        const audioPath = `uploads/${Date.now()}.mp3`;
        const transcriptionPath = `transcriptions/${Date.now()}.txt`;

        ffmpeg(videoPath)
            .output(audioPath)
            .on('end', async () => {
                try {
                    const transcriptionText = await transcribeAudioWithAssemblyAI(audioPath);

                    // Generate a presigned URL for the transcription upload
                    const transcriptionKey = `transcriptions/${uuidv4()}.txt`; // Unique file name for each transcription
                    const presignedTranscriptionUrl = s3.getSignedUrl('putObject', {
                        Bucket: bucketName,
                        Key: transcriptionKey,
                        Expires: 60 * 5, // 5 minutes expiration time
                        ContentType: 'text/plain',
                    });

                    // Upload transcription to S3 using presigned URL
                    const transcriptionUploadResponse = await axios.put(presignedTranscriptionUrl, transcriptionText, {
                        headers: {
                            'Content-Type': 'text/plain',
                        },
                    });

                    console.log('Transcription file uploaded to S3:', transcriptionUploadResponse.status);

                    // Store file info in the database
                    const userId = req.session.user.sub;
                    db.query(
                        `INSERT INTO downloads (user_id, file_name, file_path, source_url) VALUES (?, ?, ?, ?)`,
                        [userId, transcriptionKey, transcriptionKey, s3VideoKey],
                        (err) => {
                            if (err) {
                                console.error('Error saving file info to database:', err);
                            }
                        }
                    );

                    // Render the progress page
                    res.render('progress', { transcriptionUrl: presignedTranscriptionUrl, s3VideoUrl: presignedVideoUrl });
                } catch (error) {
                    console.error('Transcription or upload error:', error);
                    res.status(500).send('Transcription or S3 upload failed');
                }
            })
            .on('progress', (progress) => {
                console.log(`Processing: ${progress.percent}% done`);
            })
            .run();
    } catch (error) {
        console.error('Error uploading video to S3:', error);
        res.status(500).send('Error uploading video to S3');
    }
});


// Handle transcription from URL
app.post('/transcribe_url', isAuthenticated, async (req, res) => {
    const text = req.body.text;

    if (text) {
        const command = 'transcribe-anything';
        const args = [text];
        const childProcess = spawn(command, args);

        let output = '';

        childProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        childProcess.stderr.on('data', (data) => {
            output += `stderr: ${data.toString()}`;
        });

        childProcess.on('close', (code) => {
            if (code === 0) {
                const timestamp = Date.now();
                const filename = `transcription_${timestamp}.txt`;
                const filePath = path.join(__dirname, 'transcriptions', filename);

                fs.writeFileSync(filePath, output);

                const userId = req.session.user.sub;
                db.query(`INSERT INTO downloads (user_id, file_name, file_path, source_url) VALUES (?, ?, ?, ?)`,
                    [userId, filename, filePath, text],
                    (err) => {
                        if (err) {
                            console.error('Error saving file info to database:', err);
                        }
                    });

                res.download(filePath);
            } else {
                res.status(500).json({ output: `Process exited with code ${code}` });
            }
        });

        childProcess.on('error', (error) => {
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
    //const userId = req.session.user.sub;
    const userId = '1';

    db.query(`SELECT * FROM downloads WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, rows) => {
        if (err) {
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