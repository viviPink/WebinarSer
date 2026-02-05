const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const axios = require('axios');

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const audioDir = path.join(__dirname, 'uploads', 'audio');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    cb(null, audioDir);
  },
  filename: function (req, file, cb) {
    const sessionId = req.body.sessionId || 'unknown';
    const teacherId = req.body.teacherId || 'unknown';
    const timestamp = Date.now();
    const randomId = uuidv4().slice(0, 8);
    const filename = `recording_${sessionId}_${teacherId}_${timestamp}_${randomId}.webm`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedMimes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только аудио файлы разрешены'));
    }
  }
});

// Транскрибация через Whisper
const transcribeAudio = async (filePath) => {
  const formData = new FormData();
  formData.append('audio', fs.createReadStream(filePath), {
    filename: path.basename(filePath)
  });
  
  try {
    const response = await axios.post('http://localhost:5000/transcribe', formData, {
      headers: formData.getHeaders(),
      timeout: 300000
    });
    return response.data?.text?.trim() || '';
  } catch (error) {
    console.error('Ошибка транскрибации:', error.message);
    throw error;
  }
};

module.exports = { upload, transcribeAudio };