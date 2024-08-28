const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');

const app = express();
const port = 3000;

// AssemblyAI API key
const ASSEMBLYAI_API_KEY = 'f6ac0ab5e04141dca16baf2571bc8c5a'; // Replace with your AssemblyAI API key

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

    // Extract audio from video
    ffmpeg(videoPath)
        .output(audioPath)
        .on('end', async () => {
            try {
                const transcriptionText = await transcribeAudioWithAssemblyAI(audioPath);
                fs.writeFileSync(transcriptionPath, transcriptionText);
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

// Download transcription
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