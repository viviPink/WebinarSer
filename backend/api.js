const express = require('express');
const router = express.Router();
const { db } = require('./services');
const { upload, transcribeAudio } = require('./utils');
const path = require('path');
const fs = require('fs');

// Получаем io из app (будет установлен позже)
let io;
const setIO = (socketIO) => {
  io = socketIO;
};

// Вход преподавателя
router.post('/teacher/login', async (req, res) => {
  const { name, email } = req.body;
  try {
    let teacher = await db.findTeacherByEmail(email);
    if (!teacher) {
      teacher = await db.createTeacher(name, email);
    }
    res.json(teacher);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Курсы преподавателя
router.get('/teacher/:teacherId/courses', async (req, res) => {
  try {
    const courses = await db.getTeacherCourses(req.params.teacherId);
    res.json(courses);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать курс
router.post('/teacher/courses/create', async (req, res) => {
  const { teacherId, title } = req.body;
  try {
    const course = await db.createCourse(teacherId, title);
    res.json(course);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать сессию вебинара
router.post('/teacher/sessions/create', async (req, res) => {
  const { courseId } = req.body;
  try {
    const session = await db.createSession(courseId);
    res.json(session);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Активные сессии преподавателя
router.get('/teacher/:teacherId/sessions/active', async (req, res) => {
  try {
    const sessions = await db.getTeacherActiveSessions(req.params.teacherId);
    res.json(sessions);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Завершить сессию
router.post('/sessions/:sessionId/finish', async (req, res) => {
  try {
    const session = await db.finishSession(req.params.sessionId);
    res.json(session);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход студента
router.post('/student/login', async (req, res) => {
  const { name, group } = req.body;
  try {
    let student = await db.findStudent(name, group);
    if (!student) {
      student = await db.createStudent(name, group);
    }
    res.json(student);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Активные сессии для студентов
router.get('/sessions/active', async (req, res) => {
  try {
    const sessions = await db.getAllActiveSessions();
    res.json(sessions);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Присоединиться к сессии
router.post('/attendance/join', async (req, res) => {
  const { studentName, groupName, sessionId } = req.body;
  try {
    let student = await db.findStudent(studentName, groupName);
    if (!student) {
      student = await db.createStudent(studentName, groupName);
    }
    
    const attendance = await db.createAttendance(student.id, sessionId);
    res.json({ success: true, attendance });
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// История студента
router.get('/student/:studentId/history', async (req, res) => {
  try {
    const history = await db.getStudentHistory(req.params.studentId);
    res.json(history);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сообщения сессии
router.get('/messages/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const messages = await db.getSessionMessages(sessionId);
    res.json(messages);
  } catch (err) {
    console.error('Ошибка получения сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ЗАГРУЗКА АУДИО ФАЙЛА - ТОЛЬКО ОДИН РАЗ
router.post('/audio/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const { sessionId, teacherId, title, description, duration } = req.body;
    const filePath = `/uploads/audio/${req.file.filename}`;
    const fileSize = req.file.size;
    
    const recording = await db.createAudioRecording({
      sessionId, teacherId, fileName: req.file.filename, filePath, fileSize,
      duration, title, description
    });

    // Отправляем уведомление через WebSocket
    if (io) {
      const roomName = `session_${sessionId}`;
      io.to(roomName).emit('audio_recording_added', {
        recording,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      recording,
      message: 'Аудиозапись успешно сохранена'
    });
  } catch (err) {
    console.error('Ошибка загрузки аудио:', err);
    res.status(500).json({ error: 'Ошибка сохранения аудиозаписи' });
  }
});

// Аудиозаписи сессии
router.get('/audio/session/:sessionId', async (req, res) => {
  try {
    const recordings = await db.getSessionRecordings(req.params.sessionId);
    res.json(recordings);
  } catch (err) {
    console.error('Ошибка получения аудиозаписей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить одну аудиозапись
router.get('/audio/:recordingId', async (req, res) => {
  try {
    const recording = await db.getRecordingById(req.params.recordingId);
    if (!recording) return res.status(404).json({ error: 'Аудиозапись не найдена' });
    res.json(recording);
  } catch (err) {
    console.error('Ошибка получения аудиозаписи:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить аудиозапись
router.delete('/audio/:recordingId', async (req, res) => {
  try {
    const recording = await db.getRecordingById(req.params.recordingId);
    if (!recording) return res.status(404).json({ error: 'Аудиозапись не найдена' });
    
    const filePath = path.join(__dirname, '..', 'uploads', 'audio', recording.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    await db.deleteRecording(req.params.recordingId);
    res.json({ success: true, message: 'Аудиозапись удалена' });
  } catch (err) {
    console.error('Ошибка удаления аудиозаписи:', err);
    res.status(500).json({ error: 'Ошибка удаления аудиозаписи' });
  }
});

// Аудиозаписи преподавателя
router.get('/audio/teacher/:teacherId', async (req, res) => {
  try {
    const recordings = await db.getTeacherRecordings(req.params.teacherId);
    res.json(recordings);
  } catch (err) {
    console.error('Ошибка получения аудиозаписей преподавателя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ТРАНСКРИБИРОВАНИЕ АУДИО - ТОЛЬКО ОДИН РАЗ
router.post('/audio/:recordingId/transcribe', async (req, res) => {
  const { recordingId } = req.params;
  
  try {
    const recording = await db.getRecordingById(recordingId);
    if (!recording) return res.status(404).json({ error: 'Запись не найдена' });
    
    const filePath = path.join(__dirname, '..', 'uploads', 'audio', recording.fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Аудиофайл не найден' });
    }
    
    console.log('Начинаем транскрибирование файла:', filePath);
    const transcriptionText = await transcribeAudio(filePath);
    console.log('Транскрибирование завершено, длина текста:', transcriptionText.length);
    
    await db.updateRecordingTranscription(recordingId, transcriptionText);
    
    const wordCount = transcriptionText.trim() === '' ? 0 : transcriptionText.split(/\s+/).length;
    
    res.json({
      success: true,
      text: transcriptionText,
      wordCount,
      processingTime: 0
    });
    
  } catch (err) {
    console.error('Ошибка транскрибирования:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка транскрибирования',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Сервис транскрибирования недоступен'
    });
  }
});

// Информация о сессии
router.get('/sessions/:sessionId/info', (req, res) => {
  const { sessionId } = req.params;
  const { getSessionInfo } = require('./websocket');
  const info = getSessionInfo(sessionId);
  res.json(info);
});

// Статистика сервера
router.get('/server/stats', (req, res) => {
  const { getServerStats } = require('./websocket');
  const stats = getServerStats();
  
  db.getRecordingsCount()
    .then(count => {
      stats.audioRecordings = parseInt(count);
      res.json(stats);
    })
    .catch(() => res.json(stats));
});

// Проверка здоровья
router.get('/health', async (req, res) => {
  const audioDir = path.join(__dirname, '..', 'uploads', 'audio');
  const audioFilesCount = fs.existsSync(audioDir) ? fs.readdirSync(audioDir).length : 0;
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected',
    audioStorage: fs.existsSync(audioDir) ? 'available' : 'unavailable',
    audioFilesCount
  });
});

module.exports = { router, setIO };