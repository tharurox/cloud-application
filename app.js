const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const port = 3000;

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

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
app.get('/', (req, res) => {
    res.render('index');
});

// Handle file upload and transcription
app.post('/upload', upload.single('video'), async (req, res) => {
    const videoPath = req.file.path;
    const audioPath = `uploads/${Date.now()}.mp3`;
    const transcriptionPath = `transcriptions/${Date.now()}.txt`;

    // Extract audio and transcribe
    ffmpeg(videoPath)
        .output(audioPath)
        .on('end', async () => {
            // Simulate transcription
            const transcriptionText = await mockTranscribe(audioPath);

            fs.writeFileSync(transcriptionPath, transcriptionText);
            res.render('progress', { transcriptionPath });
        })
        .on('progress', (progress) => {
            // You can emit progress to the client here via WebSocket or SSE
            console.log(`Processing: ${progress.percent}% done`);
        })
        .run();
});

// Download transcription
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'transcriptions', req.params.filename);
    res.download(filePath);
});

// Mock transcription function (replace with a real transcription API)
function mockTranscribe(audioPath) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve('This is a transcribed text of the uploaded video.');
        }, 3000); // Simulate delay
    });
}

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});