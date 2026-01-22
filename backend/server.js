const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// === ИМПОРТЫ ДЛЯ WHISPER ===
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const server = http.createServer(app);

// Создаем папки для загрузок если их нет
const uploadsDir = path.join(__dirname, 'uploads');
const audioDir = path.join(uploadsDir, 'audio');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Настройка multer для загрузки аудиофайлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
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
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB лимит
  },
  fileFilter: function (req, file, cb) {
    const allowedMimes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только аудио файлы разрешены (webm, wav, mp3, ogg)'));
    }
  }
});

// CORS настройки — ДОЛЖНЫ БЫТЬ ПЕРВЫМИ
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Disposition']
}));

app.use(express.json());
app.use(express.static('public'));

// Разрешаем доступ к папке с аудио файлами
app.use('/uploads/audio', express.static(audioDir));

// Socket.io настройки
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3001;

// Подключение к PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('connect', () => console.log('PostgreSQL подключен'));
pool.on('error', (err) => console.error('Ошибка PostgreSQL:', err));

// Создаем таблицу для аудиозаписей если её нет
const createAudioRecordingsTable = async () => {
  try {
    await pool.query(`
      
    `);
    console.log('Таблица AudioRecording создана/проверена');
  } catch (err) {
    console.error('Ошибка создания таблицы AudioRecording:', err);
  }
};

// Добавляем колонки для транскрипции если их нет
const addTranscriptionColumns = async () => {
  try {
    await pool.query(`
 
    `);
    console.log('Таблица AudioRecording проверена/обновлена для транскрипций');
  } catch (err) {
    console.error('Ошибка при добавлении колонок транскрипции:', err);
  }
};

createAudioRecordingsTable();
addTranscriptionColumns();


// API ЭНДПОИНТЫ


app.options('*', cors());

// Вход преподавателя
app.post('/api/teacher/login', async (req, res) => {
  const { name, email } = req.body;
  try {
    let result = await pool.query('SELECT * FROM "Teacher" WHERE email = $1', [email]);
    let teacher = result.rows[0];

    if (!teacher) {
      const insert = await pool.query(
        'INSERT INTO "Teacher" (name, email) VALUES ($1, $2) RETURNING *',
        [name, email]
      );
      teacher = insert.rows[0];
    }

    res.json(teacher);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Курсы преподавателя
app.get('/api/teacher/:teacherId/courses', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM "Course" WHERE "teacherId" = $1',
      [req.params.teacherId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать курс
app.post('/api/teacher/courses/create', async (req, res) => {
  const { teacherId, title } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO "Course" ("teacherId", title) VALUES ($1, $2) RETURNING *',
      [teacherId, title]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать сессию вебинара
app.post('/api/teacher/sessions/create', async (req, res) => {
  const { courseId } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO "Session" ("courseId", "isActive", "startTime") VALUES ($1, true, NOW()) RETURNING *',
      [courseId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Активные сессии преподавателя
app.get('/api/teacher/:teacherId/sessions/active', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.title as "courseTitle" 
       FROM "Session" s 
       JOIN "Course" c ON s."courseId" = c.id 
       WHERE c."teacherId" = $1 AND s."isActive" = true`,
      [req.params.teacherId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Завершить сессию
app.post('/api/sessions/:sessionId/finish', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE "Session" SET "isActive" = false, "endTime" = NOW() WHERE id = $1 RETURNING *',
      [req.params.sessionId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход студента
app.post('/api/student/login', async (req, res) => {
  const { name, group } = req.body;
  try {
    let result = await pool.query(
      'SELECT * FROM "Student" WHERE "full_name" = $1 AND "group" = $2',
      [name, group]
    );
    let student = result.rows[0];

    if (!student) {
      const insert = await pool.query(
        'INSERT INTO "Student" ("full_name", "group") VALUES ($1, $2) RETURNING *',
        [name, group]
      );
      student = insert.rows[0];
    }

    res.json(student);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Активные сессии для студентов
app.get('/api/sessions/active', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.title as "courseTitle", t.name as "teacherName"
       FROM "Session" s 
       JOIN "Course" c ON s."courseId" = c.id 
       JOIN "Teacher" t ON c."teacherId" = t.id
       WHERE s."isActive" = true`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Присоединиться к сессии
app.post('/api/attendance/join', async (req, res) => {
  const { studentName, groupName, sessionId } = req.body;

  try {
    let studentResult = await pool.query(
      'SELECT id FROM "Student" WHERE "full_name" = $1 AND "group" = $2',
      [studentName, groupName]
    );
    
    let studentId;
    if (studentResult.rows.length === 0) {
      const newStudent = await pool.query(
        'INSERT INTO "Student" ("full_name", "group") VALUES ($1, $2) RETURNING id',
        [studentName, groupName]
      );
      studentId = newStudent.rows[0].id;
    } else {
      studentId = studentResult.rows[0].id;
    }

    const attendance = await pool.query(
      'INSERT INTO "Attendance" ("studentId", "sessionId") VALUES ($1, $2) RETURNING *',
      [studentId, sessionId]
    );

    res.json({ success: true, attendance: attendance.rows[0] });
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// История студента
app.get('/api/student/:studentId/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.title as "courseTitle", t.name as "teacherName"
       FROM "Attendance" a
       JOIN "Session" s ON a."sessionId" = s.id
       JOIN "Course" c ON s."courseId" = c.id
       JOIN "Teacher" t ON c."teacherId" = t.id
       WHERE a."studentId" = $1
       ORDER BY a."joinTime" DESC`,
      [req.params.studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить историю чата для сессии
app.get('/api/messages/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT m.*, 
        CASE 
          WHEN m."senderType" = 'teacher' THEN t.name
          WHEN m."senderType" = 'student' THEN s."full_name"
        END as "senderName"
       FROM "Message" m
       LEFT JOIN "Teacher" t ON m."senderId" = t.id AND m."senderType" = 'teacher'
       LEFT JOIN "Student" s ON m."senderId" = s.id AND m."senderType" = 'student'
       WHERE m."sessionId" = $1
       ORDER BY m."timestamp" ASC`,
      [sessionId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения сообщений:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ======================
// API ДЛЯ АУДИОЗАПИСЕЙ
// ======================

app.post('/api/audio/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const { sessionId, teacherId, title, description, duration } = req.body;
    
    const filePath = `/uploads/audio/${req.file.filename}`;
    const fileSize = req.file.size;
    
    const result = await pool.query(
      `INSERT INTO "AudioRecording" 
       ("sessionId", "teacherId", "fileName", "filePath", "fileSize", "duration", "title", "description", "transcription") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [sessionId, teacherId, req.file.filename, filePath, fileSize, duration, title, description, '']
    );

    if (sessionId) {
      const roomName = `session_${sessionId}`;
      io.to(roomName).emit('audio_recording_added', {
        recording: result.rows[0],
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      recording: result.rows[0],
      message: 'Аудиозапись успешно сохранена'
    });
  } catch (err) {
    console.error('Ошибка загрузки аудио:', err);
    res.status(500).json({ error: 'Ошибка сохранения аудиозаписи' });
  }
});

app.get('/api/audio/session/:sessionId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, t.name as "teacherName"
       FROM "AudioRecording" ar
       LEFT JOIN "Teacher" t ON ar."teacherId" = t.id
       WHERE ar."sessionId" = $1
       ORDER BY ar."createdAt" DESC`,
      [req.params.sessionId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения аудиозаписей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/audio/:recordingId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, t.name as "teacherName"
       FROM "AudioRecording" ar
       LEFT JOIN "Teacher" t ON ar."teacherId" = t.id
       WHERE ar.id = $1`,
      [req.params.recordingId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Аудиозапись не найдена' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения аудиозаписи:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/audio/:recordingId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM "AudioRecording" WHERE id = $1',
      [req.params.recordingId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Аудиозапись не найдена' });
    }
    
    const recording = result.rows[0];
    const filePath = path.join(audioDir, recording.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    await pool.query('DELETE FROM "AudioRecording" WHERE id = $1', [req.params.recordingId]);
    
    res.json({ success: true, message: 'Аудиозапись удалена' });
  } catch (err) {
    console.error('Ошибка удаления аудиозаписи:', err);
    res.status(500).json({ error: 'Ошибка удаления аудиозаписи' });
  }
});

app.get('/api/audio/teacher/:teacherId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, s."startTime" as "sessionDate", c.title as "courseTitle"
       FROM "AudioRecording" ar
       LEFT JOIN "Session" s ON ar."sessionId" = s.id
       LEFT JOIN "Course" c ON s."courseId" = c.id
       WHERE ar."teacherId" = $1
       ORDER BY ar."createdAt" DESC`,
      [req.params.teacherId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения аудиозаписей преподавателя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ТРАНСКРИБИРОВАНИЕ АУДИО 


app.post('/api/audio/:recordingId/transcribe', async (req, res) => {
  const { recordingId } = req.params;
  
  try {
    console.log(`🔍 Начинаем транскрибирование записи ID: ${recordingId}`);
    
    // 1. Получаем запись из БД
    const recResult = await pool.query(
      'SELECT "fileName" FROM "AudioRecording" WHERE id = $1',
      [recordingId]
    );
    
    if (recResult.rows.length === 0) {
      console.log(`Запись ID ${recordingId} не найдена в БД`);
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    const { fileName } = recResult.rows[0];
    const filePath = path.join(__dirname, 'uploads', 'audio', fileName);
    
    // 2. Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      console.log(`Файл не найден на диске: ${filePath}`);
      return res.status(404).json({ error: 'Аудиофайл не найден' });
    }
    
    // 3. Отправляем файл в Whisper
    console.log(`📤 Отправляем файл в Whisper: ${fileName}`);
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(filePath), {
      filename: fileName
    });
    
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:5000/transcribe', formData, {
      headers: formData.getHeaders(),
      timeout: 300000 // 5 минут таймаут
    });
    
    const processingTime = Date.now() - startTime;
    
    // 4. Проверяем ответ от Whisper
    if (response.data?.text) {
      const transcriptionText = response.data.text.trim();
      const wordCount = transcriptionText.split(/\s+/).length;
      
      // 5. Сохраняем транскрипцию в БД
      await pool.query(
        `UPDATE "AudioRecording" 
         SET "transcription" = $1
         WHERE id = $2`,
        [transcriptionText, recordingId]
      );
      
      console.log(`Транскрипция сохранена в БД. Слов: ${wordCount}`);
      
      res.json({
        success: true,
        text: transcriptionText,
        wordCount: wordCount,
        processingTime: processingTime
      });
      
    } else {
      throw new Error('Whisper вернул пустой результат');
    }
    
  } catch (err) {
    console.error(' Ошибка транскрибирования:', err.message);
    
    res.status(500).json({ 
      success: false,
      error: 'Ошибка транскрибирования',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// WEBSOCKET ЛОГИКА


const activeConnections = new Map();
const sessionRooms = new Map();
const sessionParticipants = new Map();

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);
  
  activeConnections.set(socket.id, {
    socketId: socket.id,
    connectedAt: new Date(),
    room: null
  });

  // WebRTC: ОСНОВНЫЕ СОБЫТИЯ 

  socket.on('teacher_start_screen_share', ({ sessionId, streamType = 'teacher_to_all' }) => {
    const roomName = `session_${sessionId}`;
    const teacherInfo = activeConnections.get(socket.id);
    
    if (!teacherInfo || teacherInfo.userType !== 'teacher') {
      socket.emit('error', { message: 'То' });
      return;
    }

    io.to(roomName).emit('teacher_screen_share_started', {
      teacherSocketId: socket.id,
      teacherName: teacherInfo.userName,
      timestamp: new Date(),
      streamType
    });
  });

  socket.on('teacher_send_offer_to_students', ({ sessionId, studentSocketIds, sdp }) => {
    const teacherInfo = activeConnections.get(socket.id);
    if (!teacherInfo || teacherInfo.userType !== 'teacher') {
      return;
    }

    studentSocketIds.forEach(studentSocketId => {
      const studentSocket = io.sockets.sockets.get(studentSocketId);
      if (studentSocket) {
        studentSocket.emit('teacher_webrtc_offer', {
          from: socket.id,
          sdp,
          streamType: 'teacher_to_all',
          sessionId
        });
      }
    });
  });

  socket.on('teacher_request_student_screen', ({ sessionId, studentSocketId }) => {
    const teacherInfo = activeConnections.get(socket.id);
    if (!teacherInfo || teacherInfo.userType !== 'teacher') {
      socket.emit('error', { message: 'То' });
      return;
    }

    const roomName = `session_${sessionId}`;
    const participantsMap = sessionParticipants.get(roomName);
    const studentInfo = participantsMap?.get(studentSocketId);
    
    if (!studentInfo || studentInfo.userType !== 'student') {
      socket.emit('error', { message: 'Студент не найден или не подключен' });
      return;
    }

    const studentSocket = io.sockets.sockets.get(studentSocketId);
    if (studentSocket) {
      studentSocket.emit('teacher_requested_student_screen', {
        teacherSocketId: socket.id,
        teacherName: teacherInfo.userName,
        sessionId,
        requestId: uuidv4().slice(0, 8)
      });
      
      socket.emit('screen_request_sent', {
        studentSocketId,
        studentName: studentInfo.userName,
        timestamp: new Date()
      });
    } else {
      socket.emit('error', { message: 'Студент не в сети' });
    }
  });

  socket.on('webrtc_offer', ({ to, sdp, streamType, sessionId }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('webrtc_offer', { from: socket.id, sdp, streamType, sessionId });
    }
  });

  socket.on('student_webrtc_offer', ({ to, sdp, streamType, sessionId }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('student_webrtc_offer', { from: socket.id, sdp, streamType, sessionId });
    }
  });

  socket.on('webrtc_answer', ({ to, sdp }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('webrtc_answer', { from: socket.id, sdp });
    }
  });

  socket.on('webrtc_ice_candidate', ({ to, candidate }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('webrtc_ice_candidate', { from: socket.id, candidate });
    }
  });

  socket.on('stop_screen_share', ({ sessionId, streamType, targetSocketId, requestId }) => {
    const roomName = `session_${sessionId}`;
    
    if (streamType === 'teacher_to_all') {
      io.to(roomName).emit('teacher_screen_share_stopped', {
        teacherSocketId: socket.id,
        timestamp: new Date()
      });
    } else if (streamType === 'student_to_teacher' && targetSocketId) {
      const teacherSocket = io.sockets.sockets.get(targetSocketId);
      if (teacherSocket) {
        teacherSocket.emit('student_screen_share_stopped', {
          studentSocketId: socket.id,
          requestId,
          timestamp: new Date()
        });
      }
    } else if (streamType === 'student_screen_share') {
      const studentSocket = io.sockets.sockets.get(targetSocketId);
      if (studentSocket) {
        studentSocket.emit('teacher_stopped_watching', {
          teacherSocketId: socket.id,
          timestamp: new Date()
        });
      }
    }
  });

  socket.on('join_webinar', async (data) => {
    const { sessionId, userType, userId, userName } = data;
    const roomName = `session_${sessionId}`;
    
    if (!sessionParticipants.has(roomName)) {
      sessionParticipants.set(roomName, new Map());
    }
    
    const participantsMap = sessionParticipants.get(roomName);
    let existingSocketId = null;
    for (const [sockId, participant] of participantsMap.entries()) {
      if (participant.userId === userId && participant.userType === userType) {
        existingSocketId = sockId;
        break;
      }
    }
    
    if (existingSocketId) {
      participantsMap.delete(existingSocketId);
      const oldSocket = io.sockets.sockets.get(existingSocketId);
      if (oldSocket) {
        oldSocket.leave(roomName);
        oldSocket.disconnect(true);
      }
      if (sessionRooms.has(roomName)) {
        sessionRooms.get(roomName).delete(existingSocketId);
      }
      activeConnections.delete(existingSocketId);
    }
    
    participantsMap.set(socket.id, {
      userType,
      userId,
      userName,
      socketId: socket.id,
      joinedAt: new Date(),
      isReconnect: !!existingSocketId
    });
    
    activeConnections.set(socket.id, {
      ...activeConnections.get(socket.id),
      sessionId,
      userType,
      userId,
      userName,
      room: roomName,
      joinedAt: new Date(),
      isReconnect: !!existingSocketId
    });
    
    socket.join(roomName);
    
    if (!sessionRooms.has(roomName)) {
      sessionRooms.set(roomName, new Set());
    }
    sessionRooms.get(roomName).add(socket.id);
    
    const roomParticipants = Array.from(participantsMap.values());
    io.to(roomName).emit('participants_list', roomParticipants);
    
    if (!existingSocketId) {
      socket.to(roomName).emit('user_joined', {
        userType,
        userName,
        userId,
        socketId: socket.id,
        timestamp: new Date()
      });
    }
    
    if (userType === 'teacher') {
      const students = roomParticipants.filter(p => p.userType === 'student');
      socket.emit('students_for_monitoring', students);
    }
    
    if (userType === 'student') {
      const teacher = roomParticipants.find(p => p.userType === 'teacher');
      if (teacher) {
        socket.emit('teacher_present', {
          teacherName: teacher.userName,
          teacherSocketId: teacher.socketId
        });
      }
    }
  });

  socket.on('leave_webinar', ({ sessionId }) => {
    const connectionInfo = activeConnections.get(socket.id);
    if (!connectionInfo) return;
    
    const { userType, userName, room } = connectionInfo;
    
    if (room && sessionRooms.has(room)) {
      sessionRooms.get(room).delete(socket.id);
      if (sessionParticipants.has(room)) {
        sessionParticipants.get(room).delete(socket.id);
        const participantsMap = sessionParticipants.get(room);
        const roomParticipants = Array.from(participantsMap.values());
        io.to(room).emit('participants_list', roomParticipants);
        io.to(room).emit('user_left', {
          userType,
          userName,
          socketId: socket.id,
          timestamp: new Date()
        });
        if (roomParticipants.length === 0) {
          sessionParticipants.delete(room);
        }
      }
    }
    activeConnections.delete(socket.id);
  });

  socket.on('get_participants_list', ({ sessionId }) => {
    const roomName = `session_${sessionId}`;
    if (sessionParticipants.has(roomName)) {
      const participantsMap = sessionParticipants.get(roomName);
      const roomParticipants = Array.from(participantsMap.values());
      socket.emit('participants_list', roomParticipants);
    } else {
      socket.emit('participants_list', []);
    }
  });

  socket.on('send_message', async (data) => {
    const { sessionId, message, senderType, senderId, senderName } = data;
    const timestamp = new Date();

    try {
      await pool.query(
        'INSERT INTO "Message" ("sessionId", "senderType", "senderId", text, "timestamp") VALUES ($1, $2, $3, $4, $5)',
        [sessionId, senderType, senderId, message, timestamp]
      );

      const roomName = `session_${sessionId}`;
      io.to(roomName).emit('new_message', {
        text: message,
        senderType,
        senderName,
        senderId,
        timestamp
      });
    } catch (err) {
      console.error('Ошибка сохранения сообщения:', err);
      socket.emit('message_error', { error: 'Не удалось отправить сообщение' });
    }
  });

  socket.on('start_recording', ({ sessionId, teacherId, teacherName }) => {
    const roomName = `session_${sessionId}`;
    io.to(roomName).emit('recording_started', {
      teacherId,
      teacherName,
      timestamp: new Date()
    });
  });

  socket.on('stop_recording', ({ sessionId, teacherId, teacherName }) => {
    const roomName = `session_${sessionId}`;
    io.to(roomName).emit('recording_stopped', {
      teacherId,
      teacherName,
      timestamp: new Date()
    });
  });

  socket.on('student_activity', ({ sessionId, activity }) => {
    const studentInfo = activeConnections.get(socket.id);
    if (studentInfo && studentInfo.userType === 'student') {
      const roomName = `session_${sessionId}`;
      socket.to(roomName).emit('student_activity_update', {
        studentId: studentInfo.userId,
        studentName: studentInfo.userName,
        activity,
        timestamp: new Date()
      });
    }
  });

  socket.on('disconnect', (reason) => {
    const connectionInfo = activeConnections.get(socket.id);
    if (connectionInfo) {
      const { sessionId, userType, userName, room } = connectionInfo;
      
      if (room && sessionRooms.has(room)) {
        sessionRooms.get(room).delete(socket.id);
        if (sessionParticipants.has(room)) {
          sessionParticipants.get(room).delete(socket.id);
          const participantsMap = sessionParticipants.get(room);
          const roomParticipants = Array.from(participantsMap.values());
          io.to(room).emit('participants_list', roomParticipants);
          io.to(room).emit('user_left', {
            userType,
            userName,
            socketId: socket.id,
            timestamp: new Date(),
            reason: reason
          });
          if (roomParticipants.length === 0) {
            sessionParticipants.delete(room);
          }
        }
      }
      activeConnections.delete(socket.id);
      
      if (userType === 'teacher' && room) {
        io.to(room).emit('teacher_disconnected', {
          teacherName: userName,
          timestamp: new Date()
        });
      }
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// ======================
// ДОПОЛНИТЕЛЬНЫЕ API
// ======================

app.get('/api/sessions/:sessionId/info', (req, res) => {
  const sessionId = req.params.sessionId;
  const roomName = `session_${sessionId}`;
  
  const info = {
    sessionId,
    isActive: false,
    participants: 0,
    teacherOnline: false
  };
  
  if (sessionParticipants.has(roomName)) {
    const participantsMap = sessionParticipants.get(roomName);
    const roomParticipants = Array.from(participantsMap.values());
    info.isActive = true;
    info.participants = roomParticipants.length;
    info.teacherOnline = roomParticipants.some(p => p.userType === 'teacher');
  }
  
  res.json(info);
});

app.get('/api/server/stats', (req, res) => {
  const stats = {
    activeConnections: activeConnections.size,
    activeSessions: sessionParticipants.size,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    audioRecordings: 0
  };
  
  stats.sessionParticipants = {};
  for (const [roomName, participantsMap] of sessionParticipants) {
    const sessionId = roomName.replace('session_', '');
    const roomParticipants = Array.from(participantsMap.values());
    stats.sessionParticipants[sessionId] = {
      total: roomParticipants.length,
      teachers: roomParticipants.filter(p => p.userType === 'teacher').length,
      students: roomParticipants.filter(p => p.userType === 'student').length
    };
  }
  
  pool.query('SELECT COUNT(*) FROM "AudioRecording"')
    .then(result => {
      stats.audioRecordings = parseInt(result.rows[0].count);
      res.json(stats);
    })
    .catch(err => {
      console.error('Ошибка получения статистики:', err);
      res.json(stats);
    });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected',
    audioStorage: fs.existsSync(audioDir) ? 'available' : 'unavailable',
    audioFilesCount: fs.readdirSync(audioDir).length
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ==========================================
  Сервер запущен на всех интерфейсах
  HTTP: http://localhost:${PORT}
  WebSocket: ws://localhost:${PORT}
  Аудио файлы: ${audioDir}
  ==========================================
  `);
  
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  console.log('Доступные сетевые интерфейсы:');
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal) {
        console.log(`  ${interfaceName}: http://${interface.address}:${PORT}`);
      }
    });
  });
  console.log('==========================================');
});

process.on('SIGTERM', () => {
  console.log('Получен SIGTERM. Завершение работы...');
  server.close(() => {
    console.log('HTTP сервер закрыт');
    pool.end(() => {
      console.log('PostgreSQL подключение закрыто');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('Получен SIGINT. Завершение работы...');
  server.close(() => {
    console.log('HTTP сервер закрыт');
    pool.end(() => {
      console.log('PostgreSQL подключение закрыто');
      process.exit(0);
    });
  });
});

process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный rejection:', reason);
});