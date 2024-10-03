const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const { CognitoUserPool, CognitoUserAttribute, CognitoUser, AuthenticationDetails } = require('amazon-cognito-identity-js');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const flash = require('connect-flash');
const { spawn } = require('child_process');
const db = require('./config/database'); // Using MySQL from config/database.js
const dbPromise = require('./config/database'); // Ensure db is returned as a Promise
const app = express();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
require('dotenv').config();

const port = 3000;
const GOOGLE_ID = "909473958500-h7qm6q6mpfkldnrb5b27iqdggtm87ek6.apps.googleusercontent.com";
const Google_secret = "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";
const Google_callback_url="/auth/google/callback";

// Set up session management
app.use(session({
    secret: 'IQoJb3JpZ2luX2VjEFYaDmFwLXNvdXRoZWFzdC0yIkcwRQIgEvuMejNGLNOpuvoCtxwsx8I2y0yDskPm5oUiDWAmnHsCIQCaOL/DDCe/mCeRc9NuNSBlJHoK+f/NIEv5Xmj2ysIpuSquAwif//////////8BEAMaDDkwMTQ0NDI4MDk1MyIMJd0TzO9yPAS+aEHQKoIDYuReFgMTignFK8lOpnLMnwkUjJh7XoEV6CfaduLpm4NNCDil1fz+ezxOqIhw12Djgf6N/Zr0yyys3EGr95t6/FxvRQSZ0caTB9dkexVmvBnK7BXWlYhHyhpXcsY3lTast1J4pALIHaTZGiZeQ+C/pyA3bswbg9mLMaOK6ka0Kl4VMuhjdRQLsGmkG6dtjNW38Jf2x8qF2rWcbiB6Ewk++F3ilI+IKt7JBy296qfvLTpAntbygIb28m7QV9xnOVeN12+NOG4moVg8Td16FVYsablCXKKiu4T/PAPbFRGgCRKSQBqgwjrzxASsOmufn6o0xoN2xN5UuAmNdtvCpDF39hXJ8+Ke9fYX64imxQI7fCQin758hziCJS1CVgnYN9DO5Wj1aLO3H70rRDbe7n208sPWIg4EcIzMXeKznf/RAu9GyQn+9jExGoeAkbsENVvcGI2kKYp0jh6FTFXe4W/XUNtd+tcDqz95iXPZECu0Rl+qN2G0T7daXYk0ObYiT/vfhtEwmMvztwY6pgGd6ZuOOerB1X2Vr3+BYTrjVPaEJTZprKHH/ZPqTAFhiTY2SGfuQ+pjM0yGsWLEWDtMWrUhVNflYsT0TG17QEYiML5jn6CsdyDH+Rw462dZCUn0HJQCHvwbsM1FEaKv8c5rEGgUZhyjON9qdnazIGuYNZ3KAnfawHF6vtjgWvaSgvLCyTJJtOZ7Bk8p2z29WRj0rDZOYaMHVF1E/Ud4G6pfkE4RLlhH', // Replace with your own secret key
    resave: false, // Don't save the session if it's not modified
    saveUninitialized: false, // Don't create session until something is stored
    cookie: { secure: false } // Set secure to true if using HTTPS
}));



// Set up flash middleware for flash messages
app.use(flash());

// Middleware to set flash messages as locals for access in templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

passport.use(new GoogleStrategy({
    clientID: GOOGLE_ID,
    clientSecret: Google_secret,
    callbackURL: Google_callback_url,
    scope: ['profile', 'email']  // Include required scopes
}, (token, tokenSecret, profile, done) => {
    // Here you can link the Google profile to a user in your database
    done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());


passport.use(new GoogleStrategy({
    clientID: GOOGLE_ID,
    clientSecret: Google_secret,
    callbackURL: Google_callback_url
}, (token, tokenSecret, profile, done) => {
    // Here you can link the Google profile to a user in your database
    done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

app.get('/', isLoggedIn, (req, res) => {
    res.render('index', { user: req.user });
});

app.use(passport.initialize());
app.use(passport.session());

// AWS Cognito Pool Info
const poolData = {
    UserPoolId: 'ap-southeast-2_I9D8Pcsv0',
    ClientId: '6jh4jpfupkuu2nq3elp8rhc147'
};
const userPool = new CognitoUserPool(poolData);

AWS.config.update({
    region: 'ap-southeast-2'
});


passport.use(new GoogleStrategy({
    clientID: GOOGLE_ID,
    clientSecret: Google_secret,
    callbackURL: Google_callback_url
}, (token, tokenSecret, profile, done) => {
    // Here you can link the Google profile to a user in your database
    done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());


const { v4: uuidv4 } = require('uuid'); // For unique file names

// Set up S3 with your credentials and region
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  sessionToken: process.env.AWS_SESSION_TOKEN
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
// Inside your route where `db.query` is used:
app.post('/register', async (req, res) => {
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

    userPool.signUp(username, password, attributeList, null, async (err, data) => {
        if (err) {
            req.flash('error_msg', `Error registering user: ${err.message}`);
            return res.redirect('/register');
        }

        // If the user is successfully registered in Cognito
        const userId = data.userSub; // This is the Cognito User Sub (UUID)

        try {
            // Wait for the db connection pool to resolve
            const db = await dbPromise;

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
        } catch (error) {
            console.error('Error handling db connection:', error);
            req.flash('error_msg', 'Database connection error.');
            res.redirect('/register');
        }
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

const cognitoIdentity = new AWS.CognitoIdentity();
// Google authentication route with required scope
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google callback route
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // The Google profile will be available in req.user
        const googleIdToken = req.user.idToken || req.user._json.sub; // Ensure proper access to the idToken

        // Check if googleIdToken is present
        if (!googleIdToken) {
            console.error('Missing Google idToken');
            return res.redirect('/');
        }

        const params = {
            IdentityPoolId: 'ap-southeast-2:04b1c923-0159-4f10-a4ed-1b5a9fa53904',  // Your Cognito Identity Pool Id
            Logins: {
                'accounts.google.com': googleIdToken // Use Google idToken for Cognito identity federation
            }
        };

        // Call Cognito Identity service to get an identityId
        cognitoIdentity.getId(params, (err, data) => {
            if (err) {
                console.error('Error fetching Cognito ID:', err);
                return res.redirect('/login');
            }

            // Once identityId is obtained, fetch credentials
            cognitoIdentity.getCredentialsForIdentity({
                IdentityId: data.IdentityId,
                Logins: params.Logins
            }, (err, credentials) => {
                if (err) {
                    console.error('Error fetching Cognito credentials:', err);
                    return res.redirect('/login');
                }

                // Store credentials in session and redirect to the home page
                req.session.credentials = credentials;
                res.redirect('/');
            });
        });
    }
);

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
        // Read the video file into memory to avoid chunked encoding
        const fileData = fs.readFileSync(videoPath);

        // Upload the video file to S3 using the presigned URL
        const videoUploadResponse = await axios.put(presignedVideoUrl, fileData, {
            headers: {
                'Content-Type': req.file.mimetype,
                'Content-Length': fileData.length, // Specify content length to avoid chunked encoding
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

                    // Ensure the database connection is initialized
                    const db = await dbPromise;

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
                    res.render('progress', { 
                        transcriptionUrl: presignedTranscriptionUrl, 
                        transcriptionPath: transcriptionKey, // Pass the transcriptionKey as transcriptionPath
                        s3VideoUrl: presignedVideoUrl 
                    });
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
app.get('/download/:filename', async (req, res) => {
    const fileName = req.params.filename; // File name passed in the URL
    const bucketName = 'n11849622-assignment-2'; // Your S3 bucket name
    const s3FileKey = `transcriptions/${fileName}`; // The file path in S3

    try {
        // Get the file from S3
        const s3Params = {
            Bucket: bucketName,
            Key: s3FileKey, // The path to the file in the S3 bucket
        };

        // Fetch the file from S3 using getObject
        const s3Response = await s3.getObject(s3Params).promise();

        // Set the correct headers for downloading the file
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'text/plain');

        // Send the file data to the response
        res.send(s3Response.Body);
    } catch (error) {
        console.error('Error downloading file from S3:', error);
        res.status(500).send('Error downloading the file');
    }
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