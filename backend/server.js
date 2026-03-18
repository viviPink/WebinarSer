/**
 Основной функционал сейчас:
 Аутентификация преподавателей и студентов 
 Управление курсами и сессиями 
  Чат WebSocket
 Запись и хранение аудио с вебинаров
 Транскрибация аудио через Whisper API
 Демонстрация экрана через WebRTC P2P
 Отслеживание посещаемости
  
  
  
  Middleware
   это программное обеспечение, которое действует как связующее звено между различными приложениями, системами или компонентами.
 */

// Импорт зависимостей
const express = require('express');         // Веб-фреймворк для создания API
const cors = require('cors');               // Middleware для CORS (междоменные запросы)
const { Pool } = require('pg');              // Клиент PostgreSQL для работы с БД
const https = require('https');              // HTTPS сервер
const fs = require('fs');                    // Работа с файловой системой
const path = require('path');                // Работа с путями файлов
const socketIo = require('socket.io');        // WebSocket для реального времени
const multer = require('multer');            // Middleware для загрузки файлов
const { v4: uuidv4 } = require('uuid');      // Генерация уникальных ID
require('dotenv').config();                   // Загрузка переменных окружения из .env
const axios = require('axios');               // HTTP клиент для запросов к Whisper API
const FormData = require('form-data');        // Формирование multipart/form-data для загрузки файлов

// Настройка сертификатов
// Пути к SSL сертификатам (см. .env)
const certPath = process.env.CERT_PATH || './certs/certificate.crt';
const keyPath = process.env.KEY_PATH || './certs/private.key';

// Проверяем наличие сертификатов перед запуском сервера
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('Сертификаты не найдены');
  process.exit(1); // Завершаем процесс с ошибкой
}

// Читаем файлы сертификатов
const privateKey = fs.readFileSync(keyPath, 'utf8');
const certificate = fs.readFileSync(certPath, 'utf8');

// Формируем объект credentials-"удостоверение личности" для HTTPS сервера
const credentials = {
  key: privateKey,
  cert: certificate
};

// инициализация самого приложения
const app = express();                       // Создаем Express приложение
const server = https.createServer(credentials, app); // Создаем HTTPS сервер

// директория для файлов
const uploadsDir = path.join(__dirname, 'uploads');     // Основная папка загрузок
const audioDir = path.join(uploadsDir, 'audio');        // Папка для аудиофайлов



// Создаем директории, если они не существуют 
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// настройка multer - загрузка файлов 
/**
 Конфигурация хранилища для multer
 Определяет куда и как сохранять загружаемые файлы
 */
const storage = multer.diskStorage({
  // Функция определения директории назначения
  destination: function (req, file, cb) {
    cb(null, audioDir); // Сохраняем в папку audio
  },
  // Функция генерации имени файла
  filename: function (req, file, cb) {
    // Извлекаем данные из тела запроса для формирования имени
    const sessionId = req.body.sessionId || 'unknown';
    const teacherId = req.body.teacherId || 'unknown';
    const timestamp = Date.now();
    const randomId = uuidv4().slice(0, 8); // Первые 8 символов UUID
    // Формируем имя: recording_{sessionId}_{teacherId}_{timestamp}_{randomId}.webm
    const filename = `recording_${sessionId}_${teacherId}_${timestamp}_${randomId}.webm`;
    cb(null, filename);
  }
});

/**
 Конфигурация загрузчика multer
  Ограничения: максимум 50MB, только аудио файлы
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, 
  },
  // Фильтр для проверки типов файлов
  fileFilter: function (req, file, cb) {
    // Разрешенные типы аудио
    const allowedMimes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true); // Принимаем файл
    } else {
      cb(new Error('что-то не так с форматом файла')); // Отклоняем
    }
  }
});

// MIDDLEWARE (ПРОМЕЖУТОЧНОЕ ПО) 
/**
 Настройка CORS (Cross-Origin Resource Sharing)
  Разрешает запросы с любых источников, поддерживает куки/учетные данные
 */
app.use(cors({
  origin: true,              // Разрешить все источники
  credentials: true,         // Разрешить отправку куки и заголовков авторизации
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Разрешенные HTTP методы
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Disposition'] // Разрешенные заголовки
}));

app.use(express.json());      // Парсинг JSON тела запроса
app.use(express.static('public')); // Раздача статических файлов из папки public

/**
 Логирующий middleware
  Записывает все входящие запросы и их тела (для POST/PUT)
 */
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Body:', JSON.stringify(req.body, null, 2)); // Форматированный вывод тела
  }
  next(); // Передаем управление следующему middleware
});

// Раздача статических файлов из папки uploads/audio по URL /uploads/audio
app.use('/uploads/audio', express.static(audioDir));

// настройка Websocet (socket.io)
const io = socketIo(server, {
  cors: {
    origin: "*",              // Разрешить все источники
    methods: ["GET", "POST"], // Разрешенные методы
    credentials: true
  },
  transports: ['websocket', 'polling'], // Поддерживаемые транспорты (WebSocket и long-polling)
  pingTimeout: 60000,         // Таймаут пинга (60 сек)
  pingInterval: 25000         // Интервал пинга (25 сек)
});

// порт сервера
const PORT = process.env.PORT || 3001; // Порт из .env или 3001 


/**
  соединений с PostgreSQL
  настройки берутся из переменных окружения
 */
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Обработчики событий пула
pool.on('connect', () => console.log('PostgreSQL подключен'));
pool.on('error', (err) => console.error('Ошибка PostgreSQL:', err));


/**
 Создание таблицы AudioRecording, если она не существует
  Хранит метаданные загруженных аудиозаписей
 */
// const createAudioRecordingsTable = async () => {
//   try {
//     await pool.query(`CREATE TABLE IF NOT EXISTS "AudioRecording" (
//       id SERIAL PRIMARY KEY,                          // Уникальный ID записи
//       "sessionId" INTEGER,                            // ID сессии (вебинара)
//       "teacherId" INTEGER,                             // ID преподавателя
//       "fileName" VARCHAR(255) NOT NULL,                // Имя файла на диске
//       "filePath" VARCHAR(500) NOT NULL,                // Путь к файлу (URL)
//       "fileSize" INTEGER,                               // Размер файла в байтах
//       "duration" INTEGER,                               // Длительность в секундах
//       "title" VARCHAR(255),                             // Название записи
//       "description" TEXT,                               // Описание
//       "transcription" TEXT,                             // Транскрипция текста
//       "lastEditedAt" TIMESTAMP,                         // Время последнего редактирования
//       "createdAt" TIMESTAMP DEFAULT NOW()               // Время создания
//     )`);
//     console.log('Таблица AudioRecording создана/проверена');
//   } catch (err) {
//     console.error('Ошибка создания таблицы AudioRecording:', err);
//   }
// };

/**
 * Добавление колонок для транскрипции в существующую таблицу
 */
// const addTranscriptionColumns = async () => {
//   try {
//     await pool.query(`ALTER TABLE "AudioRecording" 
//       ADD COLUMN IF NOT EXISTS "transcription" TEXT, 
//       ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP;`);
//     console.log('Таблица AudioRecording проверена/обновлена для транскрипций');
//   } catch (err) {
//     console.error('Ошибка при добавлении колонок транскрипции:', err);
//   }
// };

// Выполняем инициализацию таблиц при старте
//createAudioRecordingsTable();
// addTranscriptionColumns();

// Обработка preflight запросов OPTIONS для CORS
app.options('*', cors());




// API эндпоинты

/**
 аунтефикация преподавателя
 POST /api/teacher/login
 Вход или регистрация преподавателя 
  Если преподаватель с таким email не найден - создает нового !!!!! надо исправить тут 
  
  Тело запроса: { name, email }
  Ответ: объект Teacher
 */
/**
Аутентификация преподавателя
POST /api/teacher/login
Вход или регистрация преподавателя
Тело запроса: { id, mail, email }
Ответ: объект Teacher
*/
app.post('/api/teacher/login', async (req, res) => {
  const { id, mail, email } = req.body;
  try {
    let result = await pool.query('SELECT * FROM "Teacher" WHERE email = $1', [email]);
    let teacher = result.rows[0];
    
    if (!teacher) {
      const insert = await pool.query(
        'INSERT INTO "Teacher" (id, mail, email) VALUES ($1, $2, $3) RETURNING *',
        [id, mail, email]
      );
      teacher = insert.rows[0];
    }
    res.json(teacher);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});




/**
 * GET /api/courses/:courseId/sessions
 * Возвращает все сессии для указанного курса
 */
app.get('/api/courses/:courseId/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.title as "courseTitle" 
       FROM "Session" s 
       JOIN "Course" c ON s."courseId" = c.id 
       WHERE s."courseId" = $1 
       ORDER BY s."startTime" DESC`,
      [req.params.courseId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения сессий курса:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/teacher/:teacherId/attendance/report
 * Возвращает отчёт по посещаемости с фильтрами и статистикой
 */
app.get('/api/teacher/:teacherId/attendance/report', async (req, res) => {
  try {
    const { courseId, sessionId, group, studentName, studentId, dateFrom, dateTo } = req.query;
    
    // Базовый запрос (исправлен под реальную схему БД)
    let query = `
      SELECT 
        a.id as "attendanceId",
        a."studentId",
        a."sessionId",
        a."joinedAt" as "joinTime",
        s."full_name" as "studentName",
        s."group",
        c.title as "courseTitle",
        c.id as "courseId",
        sess."startTime" as "sessionDate",
        sess."endTime",
        'Присутствовал' as "status"
      FROM "Attendance" a
      JOIN "Student" s ON a."studentId" = s.id
      JOIN "Session" sess ON a."sessionId" = sess.id
      JOIN "Course" c ON sess."courseId" = c.id
      WHERE c."teacherId" = $1
    `;
    
    const params = [req.params.teacherId];
    let paramIndex = 2;
    
    // Добавляем фильтры
    if (courseId) {
      query += ` AND c.id = $${paramIndex}`;
      params.push(courseId);
      paramIndex++;
    }
    
    if (sessionId) {
      query += ` AND a."sessionId" = $${paramIndex}`;
      params.push(sessionId);
      paramIndex++;
    }
    
    if (group) {
      query += ` AND s."group" ILIKE $${paramIndex}`;
      params.push(`%${group}%`);
      paramIndex++;
    }
    
    if (studentName) {
      query += ` AND s."full_name" ILIKE $${paramIndex}`;
      params.push(`%${studentName}%`);
      paramIndex++;
    }
    
    if (studentId) {
      query += ` AND a."studentId" = $${paramIndex}`;
      params.push(studentId);
      paramIndex++;
    }
    
    if (dateFrom) {
      query += ` AND sess."startTime" >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      query += ` AND sess."startTime" <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }
    
    query += ` ORDER BY a."joinedAt" DESC`;
    
    const result = await pool.query(query, params);
    
    // Получаем статистику
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT a."studentId") as "totalStudents",
        COUNT(DISTINCT a."sessionId") as "totalSessions",
        COUNT(DISTINCT s."group") as "uniqueGroups"
      FROM "Attendance" a
      JOIN "Student" s ON a."studentId" = s.id
      JOIN "Session" sess ON a."sessionId" = sess.id
      JOIN "Course" c ON sess."courseId" = c.id
      WHERE c."teacherId" = $1
    `;
    
    const statsResult = await pool.query(statsQuery, [req.params.teacherId]);
    const stats = statsResult.rows[0];
    
    // Считаем среднюю посещаемость
    const totalStudentsInCourses = await pool.query(
      `SELECT COUNT(DISTINCT s.id) as "count"
       FROM "Student" s
       JOIN "Attendance" a ON a."studentId" = s.id
       JOIN "Session" sess ON a."sessionId" = sess.id
       JOIN "Course" c ON sess."courseId" = c.id
       WHERE c."teacherId" = $1`,
      [req.params.teacherId]
    );
    
    const totalStudents = parseInt(totalStudentsInCourses.rows[0].count) || 1;
    const averageAttendance = stats.totalStudents > 0 
      ? Math.round((stats.totalStudents / totalStudents) * 100) 
      : 0;
    
    res.json({
      attendance: result.rows,
      stats: {
        totalStudents: parseInt(stats.totalStudents) || 0,
        totalSessions: parseInt(stats.totalSessions) || 0,
        averageAttendance: averageAttendance,
        uniqueGroups: parseInt(stats.uniqueGroups) || 0,
        attendanceByCourse: []
      }
    });
  } catch (err) {
    console.error('Ошибка получения отчёта по посещаемости:', err);
    res.status(500).json({ error: 'Ошибка сервера', details: err.message });
  }
});


















/**
  GET /api/teacher/:teacherId/courses
  Возвращает все курсы, созданные преподавателем
  
  Параметры URL: teacherId
  Ответ: массив объектов Course
 */
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

/**
 создание нового курса
  POST /api/teacher/courses/create
  Создает новый курс для преподавателя
  
  Тело запроса: { teacherId, title }
  созданный объект Course
 */
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

/**
 создание вебинара 
  POST /api/teacher/sessions/create
  Создает новую активную сессию для курса
  
  Тело запроса: { courseId, description }
  созданный объект Session с isActive = true
 */
app.post('/api/teacher/sessions/create', async (req, res) => {
  const { courseId, description } = req.body; // ДОБАВЛЯЕМ description
  try {
    const result = await pool.query(
      // ДОБАВЛЯЕМ description в запрос
      'INSERT INTO "Session" ("courseId", "isActive", "startTime", "description") VALUES ($1, true, NOW(), $2) RETURNING *',
      [courseId, description || null] // Используем null, если description не передан
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания сессии:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});












// В эндпоинте POST /api/teacher/sessions/schedule
app.post('/api/teacher/sessions/schedule', async (req, res) => {
  const { teacherId, courseId, title, description, scheduledStart, duration } = req.body;
  try {
    // scheduledStart уже должен быть в ISO формате (UTC)
    // Просто используем его как есть
    const result = await pool.query(
      `INSERT INTO "ScheduledSession" 
       ("teacherId", "courseId", "title", "description", "scheduledStart", "duration", "isActive") 
       VALUES ($1, $2, $3, $4, $5, $6, false) 
       RETURNING *`,
      [teacherId, courseId, title, description, scheduledStart, duration]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка планирования сессии:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// В эндпоинте GET /api/teacher/:teacherId/sessions/scheduled
app.get('/api/teacher/:teacherId/sessions/scheduled', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ss.*, c.title as "courseTitle" 
       FROM "ScheduledSession" ss 
       JOIN "Course" c ON ss."courseId" = c.id 
       WHERE ss."teacherId" = $1 AND ss."isActive" = false
       ORDER BY ss."scheduledStart" ASC`,
      [req.params.teacherId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения запланированных сессий:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});












/**
 * Удаление запланированной сессии
 * DELETE /api/teacher/sessions/scheduled/:sessionId
 */
app.delete('/api/teacher/sessions/scheduled/:sessionId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM "ScheduledSession" WHERE id = $1',
      [req.params.sessionId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления запланированной сессии:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * Автоматический запуск запланированной сессии
 * POST /api/teacher/sessions/start-scheduled
 */
app.post('/api/teacher/sessions/start-scheduled', async (req, res) => {
  const { sessionId } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Получаем информацию о запланированной сессии
    const scheduled = await client.query(
      'SELECT * FROM "ScheduledSession" WHERE id = $1',
      [sessionId]
    );
    
    if (scheduled.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Сессия не найдена' });
    }
    
    const session = scheduled.rows[0];
    
    // Создаем активную сессию
    const activeSession = await client.query(
      'INSERT INTO "Session" ("courseId", "isActive", "startTime", "description") VALUES ($1, true, NOW(), $2) RETURNING *',
      [session.courseId, session.description || session.title]
    );
    
    // Помечаем запланированную сессию как активную (или удаляем)
    await client.query(
      'UPDATE "ScheduledSession" SET "isActive" = true WHERE id = $1',
      [sessionId]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      session: activeSession.rows[0],
      message: 'Сессия успешно запущена'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка запуска запланированной сессии:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

















/**
 Получение активных сессий преподавателя
  GET /api/teacher/:teacherId/sessions/active
  Возвращает все активные сессии преподавателя с названиями курсов
  
  Параметры URL: teacherId
  массив объектов Session с полем courseTitle
 */
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

/**
 Завершение сессии
  POST /api/sessions/:sessionId/finish
  Помечает сессию как неактивную и устанавливает время окончания
  
  Параметры URL: sessionId
 обновленный объект Session
 */
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

/**
  аутентификация студента
  POST /api/student/login
  Вход или регистрация студента по имени и группе
  Если студент не найден - создает нового
  
  Тело запроса: { name, group }
   объект Student
 */
app.post('/api/student/login', async (req, res) => {
  const { name, group } = req.body;
  try {
    // Ищем студента по имени и группе
    let result = await pool.query(
      'SELECT * FROM "Student" WHERE "full_name" = $1 AND "group" = $2',
      [name, group]
    );
    let student = result.rows[0];
    
    // Если не найден - создаем нового
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

/**
 Получение всех активных сессий
  GET /api/sessions/active
  Возвращает все активные сессии с информацией о курсе и преподавателе
  Используется студентами для просмотра доступных вебинаров
  
  Ответ: массив объектов Session с полями courseTitle и teacherName
 */
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

/**
  Отметка о посещении студентом 
  POST /api/attendance/join
  Регистрирует присоединение студента к сессии
  Если студента нет в БД - создает его   вот это было странно !!!!!!!!!!!!!!!!!!!!!!!
  
  Тело запроса: { studentName, groupName, sessionId }
  Ответ: { success: true, attendance: объект Attendance }
 */
app.post('/api/attendance/join', async (req, res) => {
  const { studentName, groupName, sessionId } = req.body;
  try {
    // Ищем студента по имени и группе
    let studentResult = await pool.query(
      'SELECT id FROM "Student" WHERE "full_name" = $1 AND "group" = $2',
      [studentName, groupName]
    );
    let studentId;
    
    // Если студент не найден - создаем
    if (studentResult.rows.length === 0) {
      const newStudent = await pool.query(
        'INSERT INTO "Student" ("full_name", "group") VALUES ($1, $2) RETURNING id',
        [studentName, groupName]
      );
      studentId = newStudent.rows[0].id;
    } else {
      studentId = studentResult.rows[0].id;
    }

    // Создаем запись о посещении
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

/**
 История посещений студента 
  GET /api/student/:studentId/history
  Возвращает все сессии, в которых участвовал студент
  
  Параметры URL: studentId
  массив объектов Session 
 */
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

/**
  Получение сообщений сессии 
  GET /api/messages/:sessionId
 Возвращает все сообщения чата для указанной сессии
  
  Параметры URL: sessionId
  Ответ: массив объектов Message с полем senderName
 */
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

/**
 Загрузка аудиозаписи
  POST /api/audio/upload
  Загружает аудиофайл с вебинара и сохраняет метаданные в БД
  Использует multer middleware для обработки файла
  После сохранения оповещает всех участников сессии через WebSocket
  
  Тело запроса (multipart/form-data):
    - audio: файл
    - sessionId: ID сессии
    - teacherId: ID преподавателя
    - title: название (опционально)
    - description: описание (опционально)
    - duration: длительность (опционально)
  объект с созданной записью
 */
app.post('/api/audio/upload', upload.single('audio'), async (req, res) => {
  try {
    // Проверяем, загружен ли файл
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    // Извлекаем данные из тела запроса
    const { sessionId, teacherId, title, description, duration } = req.body;
    const filePath = `/uploads/audio/${req.file.filename}`; // URL для доступа к файлу
    const fileSize = req.file.size; // Размер в байтах

    // Сохраняем метаданные в БД
    const result = await pool.query(
      `INSERT INTO "AudioRecording" 
       ("sessionId", "teacherId", "fileName", "filePath", "fileSize", "duration", "title", "description", "transcription") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [sessionId, teacherId, req.file.filename, filePath, fileSize, duration, title, description, '']
    );

    // Если указан sessionId, оповещаем всех в комнате через WebSocket
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

/**
 Получение аудиозаписей лекции
  GET /api/audio/session/:sessionId
  Возвращает все аудиозаписи для указанной сессии
  
  Параметры URL: sessionId
  Ответ: массив объектов AudioRecording с полем teacherName
 */
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

/**
 Получение конкретной аудио!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! тут не работает 
  GET /api/audio/:recordingId
  Возвращает данные конкретной аудиозаписи по ID
  
  Параметры URL: recordingId
  Ответ: объект AudioRecording с полем teacherName или 404
 */
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

/**
 Удаление аудиозаписи
  DELETE /api/audio/:recordingId
  Удаляет запись из БД и соответствующий файл с диска
  
  Параметры URL: recordingId
  Ответ: { success: true, message: 'Аудиозапись удалена' } или 404
 */
app.delete('/api/audio/:recordingId', async (req, res) => {
  try {
    // Сначала получаем информацию о записи
    const result = await pool.query(
      'SELECT * FROM "AudioRecording" WHERE id = $1',
      [req.params.recordingId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Аудиозапись не найдена' });
    }

    const recording = result.rows[0];
    const filePath = path.join(audioDir, recording.fileName); // Полный путь к файлу
    
    // Удаляем файл с диска, если существует
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Удаляем запись из БД
    await pool.query('DELETE FROM "AudioRecording" WHERE id = $1', [req.params.recordingId]);

    res.json({ success: true, message: 'Аудиозапись удалена' });
  } catch (err) {
    console.error('Ошибка удаления аудиозаписи:', err);
    res.status(500).json({ error: 'Ошибка удаления аудиозаписи' });
  }
});

/**
  Получение аудиозаписи преподавтеля
  GET /api/audio/teacher/:teacherId
  Возвращает все аудиозаписи преподавателя с информацией о сессии и курсе
  
  Параметры URL: teacherId
  Ответ: массив объектов AudioRecording с полями sessionDate и courseTitle
 */
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

/**
  Транскрибация аудио
  POST /api/audio/:recordingId/transcribe
  Отправляет аудиофайл на сервер Whisper для распознавания речи
  Сохраняет полученный текст в БД
  
  Параметры URL: recordingId
  Ответ: { success: true, text, wordCount, processingTime } или ошибка
 */
app.post('/api/audio/:recordingId/transcribe', async (req, res) => {
  const { recordingId } = req.params;
  try {
    console.log('Начинаем транскрибирование записи ID:', recordingId);
    
    // Получаем информацию о записи из БД
    const recResult = await pool.query(
      'SELECT "fileName" FROM "AudioRecording" WHERE id = $1',
      [recordingId]
    );
    if (recResult.rows.length === 0) {
      console.log('Запись ID', recordingId, 'не найдена в БД');
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    const { fileName } = recResult.rows[0];
    const filePath = path.join(__dirname, 'uploads', 'audio', fileName); // Полный путь к файлу

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      console.log('Файл не найден на диске:', filePath);
      return res.status(404).json({ error: 'Аудиофайл не найден' });
    }

    console.log('Отправляем файл в Whisper:', fileName);
    
    // Формируем multipart/form-data запрос
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(filePath), {
      filename: fileName
    });

    const startTime = Date.now(); // Засекаем время начала

    // Отправляем запрос к локальному серверу Whisper (порт 5000)
    const response = await axios.post('http://localhost:5000/transcribe', formData, {
      headers: formData.getHeaders(),
      timeout: 300000 // Таймаут 5 минут (для длинных аудио)!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    });

    const processingTime = Date.now() - startTime; // Вычисляем время обработки

    // Если получили текст, сохраняем в БД
    if (response.data?.text) {
      const transcriptionText = response.data.text.trim();
      const wordCount = transcriptionText.split(/\s+/).length; // Подсчет слов
      
      await pool.query(
        `UPDATE "AudioRecording" 
         SET "transcription" = $1,
             "lastEditedAt" = NOW()
         WHERE id = $2`,
        [transcriptionText, recordingId]
      );
      
      console.log('Транскрипция сохранена в БД. Слов:', wordCount);
      
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
    console.error('Ошибка транскрибирования:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка транскрибирования',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * Транскрибация фрагмента аудио (для реального времени)
 * POST /api/audio/transcribe-chunk
 */
app.post('/api/audio/transcribe-chunk', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    console.log('Фрагмент:', {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const filePath = req.file.path;
    
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ error: 'Файл не найден' });
    }

    const formData = new FormData();
    formData.append('audio', fs.createReadStream(filePath), {
      filename: req.file.filename,
      contentType: req.file.mimetype
    });

    const response = await axios.post('http://localhost:5000/transcribe-chunk', formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    // Удаляем файл
    fs.unlinkSync(filePath);

    if (response.data?.text) {
      res.json({
        success: true,
        text: response.data.text.trim(),
        processingTime: response.data.processing_time
      });
    } else {
      res.json({ success: true, text: '' });
    }
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Ошибка транскрибации',
      details: err.message
    });
  }
});

/**
 * Улучшение транскрипции через GPT
 * POST /api/enhance-transcription
 */
app.post('/api/enhance-transcription', async (req, res) => {
  try {
    const { text, action } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Текст не предоставлен' });
    }

    console.log('Улучшение текста:', { action, length: text.length });

    // Отправляем запрос на Flask сервер с GPT
    const response = await axios.post('http://localhost:5000/enhance-transcription', {
      text: text,
      action: action
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 секунд таймаут
    });

    res.json(response.data);
    
  } catch (err) {
    console.error('Ошибка улучшения текста:', err.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка улучшения текста',
      details: err.message
    });
  }
});


// Регистрация преподавателя
app.post('/api/teacher/register', async (req, res) => {
  const { name, email } = req.body; // Исправлено: вместо id, mail, email
  console.log('Регистрация преподавателя:', { name, email });
  
  try {
    const result = await pool.query(
      'INSERT INTO "Teacher" (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка регистрации преподавателя:', err);
    res.status(500).json({ error: err.message });
  }
});

// Регистрация студента (уже правильно)
app.post('/api/student/register', async (req, res) => {
  const { name, group } = req.body;
  console.log('Регистрация студента:', { name, group });
  
  try {
    const result = await pool.query(
      'INSERT INTO "Student" ("full_name", "group") VALUES ($1, $2) RETURNING *',
      [name, group]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка регистрации студента:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 Получение транскрибации для редактирования
  GET /api/audio/:recordingId/transcription/edit
  Возвращает данные записи с транскрипцией для редактирования
  
  Параметры URL: recordingId
  Ответ: объект с transcription, title, description
 */
app.get('/api/audio/:recordingId/transcription/edit', async (req, res) => {
  try {
    const { recordingId } = req.params;
    console.log('Запрос транскрипции для редактирования ID:', recordingId);
    
    const result = await pool.query(
      `SELECT ar.id, ar."transcription", ar.title, ar.description, ar."createdAt", 
              ar.duration, ar."fileSize", ar."filePath", t.name as "teacherName" 
       FROM "AudioRecording" ar 
       LEFT JOIN "Teacher" t ON ar."teacherId" = t.id 
       WHERE ar.id = $1`,
      [recordingId]
    );
    
    if (result.rows.length === 0) {
      console.log('Запись ID', recordingId, 'не найдена');
      return res.status(404).json({ 
        success: false,
        error: 'Запись не найдена' 
      });
    }

    const recording = result.rows[0];
    console.log('Транскрипция найдена, длина:', (recording.transcription || '').length, 'символов');

    res.json({
      id: recording.id,
      transcription: recording.transcription || '',
      title: recording.title || 'Без названия',
      description: recording.description || '',
      createdAt: recording.createdAt,
      duration: recording.duration,
      fileSize: recording.fileSize,
      filePath: recording.filePath,
      teacherName: recording.teacherName
    });
  } catch (err) {
    console.error('Ошибка получения транскрипции:', err);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при получении транскрипции',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 сохранение трак=нскрипции, которую отредактировали
  PUT /api/audio/:recordingId/transcription/edit
  Сохраняет отредактированный пользователем текст транскрипции
  
  Параметры URL: recordingId
  Тело запроса: { transcription }
  Ответ: { success: true, recording, message }
 */
app.put('/api/audio/:recordingId/transcription/edit', async (req, res) => {
  const { recordingId } = req.params;
  const { transcription } = req.body;
  
  console.log('Сохранение транскрипции для записи ID:', recordingId);
  console.log('Длина транскрипции:', (transcription || '').length, 'символов');
  
  
  if (transcription === undefined || transcription === null) {
    return res.status(400).json({
      success: false,
      error: 'Текст транскрипции обязателен'
    });
  }
  
  try {
    // Проверяем существование записи
    const checkResult = await pool.query(
      'SELECT id FROM "AudioRecording" WHERE id = $1',
      [recordingId]
    );
    if (checkResult.rows.length === 0) {
      console.log('Запись ID', recordingId, 'не найдена при сохранении');
      return res.status(404).json({
        success: false,
        error: 'Запись не найдена'
      });
    }

    // Обновляем транскрипцию и время последнего редактирования
    const updateResult = await pool.query(
      `UPDATE "AudioRecording" 
       SET "transcription" = $1,
           "lastEditedAt" = NOW()
       WHERE id = $2 
       RETURNING id, "transcription", "lastEditedAt"`,
      [transcription, recordingId]
    );

    console.log('Транскрипция успешно сохранена для записи ID:', recordingId);

    res.json({
      success: true,
      recording: updateResult.rows[0],
      message: 'Транскрипция успешно сохранена'
    });
  } catch (err) {
    console.error('Ошибка сохранения транскрипции:', err);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при сохранении транскрипции',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


 //Эти эндпоинты помогают при отладке и тестировании
 

/**
 GET /api/debug/audio/:id
 Возвращает данные из таблицы AudioRecording для отладки
 */
app.get('/api/debug/audio/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "AudioRecording" WHERE id = $1', [req.params.id]);
    res.json({
      exists: result.rows.length > 0,
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
  GET /api/test/transcription
  Тестовый эндпоинт для проверки работы с транскрипциями
  Возвращает первые 5 записей
 */
app.get('/api/test/transcription', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title FROM "AudioRecording" LIMIT 5');
    res.json({
      success: true,
      recordings: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Состояния WebSocket
/**
 activeConnections: Map всех активных WebSocket соединений
  Ключ: socket.id, Значение: объект с информацией о подключении
 */
const activeConnections = new Map();

/**
 sessionRooms: Map комнат сессий
  Ключ: имя комнаты (session_{sessionId}), Значение: Set из socket.id
 */
const sessionRooms = new Map();

/**
  sessionParticipants: Map участников сессий с детальной информацией
  Ключ: имя комнаты (session_{sessionId}), Значение: Map с информацией об участниках
 */
const sessionParticipants = new Map();

// Обработчики WebSockets
/**
  Обработчик нового WebSocket подключения
  Регистрирует соединение и настраивает все обработчики событий
 */
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);
  
  // Регистрируем новое соединение в activeConnections
  activeConnections.set(socket.id, {
    socketId: socket.id,
    connectedAt: new Date(),
    room: null,
    sessionId: null,
    userType: null,
    userId: null,
    userName: null
  });

  // Демонстрация экрана
  /**
   Событие: teacher_start_screen_share
   Преподаватель начинает демонстрацию экрана для всех студентов
    
    Данные: { sessionId, streamType }
   */
  socket.on('teacher_start_screen_share', ({ sessionId, streamType = 'teacher_to_all' }) => {
    const teacherInfo = activeConnections.get(socket.id);
    
  
    
    // Проверяем соответствие сессии
    if (teacherInfo.sessionId != sessionId) {
      socket.emit('error', { message: 'Несоответствие сессии' });
      return;
    }
    
    // Оповещаем всех в комнате о начале трансляции
    const roomName = `session_${sessionId}`;
    io.to(roomName).emit('teacher_screen_share_started', {
      teacherSocketId: socket.id,
      teacherName: teacherInfo.userName,
      timestamp: new Date(),
      streamType
    });
  });

  /**
   Событие: teacher_send_offer_to_students
   Преподаватель отправляет WebRTC offer выбранным студентам
    Используется для установки P2P соединения для демонстрации экрана
    
    Данные: { sessionId, studentSocketIds, sdp }
   */
  socket.on('teacher_send_offer_to_students', ({ sessionId, studentSocketIds, sdp }) => {
    const teacherInfo = activeConnections.get(socket.id);
    
    // Проверяем права преподавателя
    if (!teacherInfo || teacherInfo.userType !== 'teacher') {
      console.warn('Отклонён запрос от не-преподавателя:', socket.id);
      socket.emit('error', { message: 'Только преподаватель может отправлять офферы' });
      return;
    }
    
    // Проверяем соответствие сессии
    if (teacherInfo.sessionId != sessionId) {
      console.warn('Несоответствие сессии у преподавателя', socket.id, ': ожидаемая', teacherInfo.sessionId, ', получена', sessionId);
      socket.emit('error', { message: 'Несоответствие сессии' });
      return;
    }

    // Отправляем offer каждому студенту из списка
    studentSocketIds.forEach(studentSocketId => {
      const studentSocket = io.sockets.sockets.get(studentSocketId);
      if (studentSocket) {
        const studentInfo = activeConnections.get(studentSocketId);
        // Проверяем, что студент в той же сессии
        if (studentInfo && studentInfo.sessionId == sessionId) {
          studentSocket.emit('teacher_webrtc_offer', {
            from: socket.id,
            sdp,
            streamType: 'teacher_to_all',
            sessionId
          });
          console.log('Оффер отправлен студенту', studentSocketId, 'от преподавателя', socket.id);
        } else {
          console.warn('Студент', studentSocketId, 'не в сессии', sessionId);
        }
      } else {
        console.warn('Студент', studentSocketId, 'не подключен');
      }
    });
  });

  /**
   Событие: teacher_request_student_screen
   Преподаватель запрашивает демонстрацию экрана конкретного студента
   
   Данные: { sessionId, studentSocketId }
   */
  socket.on('teacher_request_student_screen', ({ sessionId, studentSocketId }) => {
    const teacherInfo = activeConnections.get(socket.id);
    
    
    if (!teacherInfo || teacherInfo.userType !== 'teacher') {
      socket.emit('error', { message: 'Тип не определился' });
      return;
    }
    
    // Проверяем соответствие сессии
    if (teacherInfo.sessionId != sessionId) {
      socket.emit('error', { message: 'Несоответствие сессии' });
      return;
    }

    const roomName = `session_${sessionId}`;
    const participantsMap = sessionParticipants.get(roomName);
    const studentInfo = participantsMap?.get(studentSocketId);

    // Проверяем существование студента в сессии
    if (!studentInfo || studentInfo.userType !== 'student') {
      socket.emit('error', { message: 'Студент не найден или не подключен к сессии' });
      return;
    }

    const studentConnection = activeConnections.get(studentSocketId);
    if (!studentConnection || studentConnection.sessionId != sessionId) {
      socket.emit('error', { message: 'Студент не в текущей сессии' });
      return;
    }

    // Отправляем запрос студенту
    const studentSocket = io.sockets.sockets.get(studentSocketId);
    if (studentSocket) {
      studentSocket.emit('teacher_requested_student_screen', {
        teacherSocketId: socket.id,
        teacherName: teacherInfo.userName,
        sessionId,
        requestId: uuidv4().slice(0, 8) // Уникальный ID запроса
      });
      
      // Подтверждаем преподавателю, что запрос отправлен
      socket.emit('screen_request_sent', {
        studentSocketId,
        studentName: studentInfo.userName,
        timestamp: new Date()
      });
    } else {
      socket.emit('error', { message: 'Студент не в сети' });
    }
  });

  /**
   Обработки WebRTC
   Эти события используются для обмена SDP (Session Description Protocol)
   и ICE кандидатами для установки P2P соединения
   */

  /**
   Событие: webrtc_offer
   Отправка WebRTC offer другому участнику
   */
  socket.on('webrtc_offer', ({ to, sdp, streamType, sessionId }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('webrtc_offer', { from: socket.id, sdp, streamType, sessionId });
    }
  });

  /**
   Событие: student_webrtc_offer
   Студент отправляет offer преподавателю (для демонстрации своего экрана)
   */
  socket.on('student_webrtc_offer', ({ to, sdp, streamType, sessionId }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('student_webrtc_offer', { from: socket.id, sdp, streamType, sessionId });
    }
  });

  /**
   Событие: webrtc_answer
   Ответ на полученный offer
   */
  socket.on('webrtc_answer', ({ to, sdp }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('webrtc_answer', { from: socket.id, sdp });
    }
  });

  /**
   Событие: webrtc_ice_candidate
   Обмен ICE кандидатами для установки соединения через NAT
   */
  socket.on('webrtc_ice_candidate', ({ to, candidate }) => {
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      targetSocket.emit('webrtc_ice_candidate', { from: socket.id, candidate });
    }
  });

  /**
   Событие: stop_screen_share
   Остановка демонстрации экрана (преподавателем или студентом)
   
   Данные: { sessionId, streamType, targetSocketId, requestId }
   */
  socket.on('stop_screen_share', ({ sessionId, streamType, targetSocketId, requestId }) => {
    const roomName = `session_${sessionId}`;
    
    if (streamType === 'teacher_to_all') {
      // Преподаватель останавливает трансляцию для всех
      io.to(roomName).emit('teacher_screen_share_stopped', {
        teacherSocketId: socket.id,
        timestamp: new Date()
      });
    } else if (streamType === 'student_to_teacher' && targetSocketId) {
      // Студент останавливает трансляцию для преподавателя
      const teacherSocket = io.sockets.sockets.get(targetSocketId);
      if (teacherSocket) {
        teacherSocket.emit('student_screen_share_stopped', {
          studentSocketId: socket.id,
          requestId,
          timestamp: new Date()
        });
      }
    } else if (streamType === 'student_screen_share' && targetSocketId) {
      // Преподаватель прекращает просмотр экрана студента
      const studentSocket = io.sockets.sockets.get(targetSocketId);
      if (studentSocket) {
        studentSocket.emit('teacher_stopped_watching', {
          teacherSocketId: socket.id,
          timestamp: new Date()
        });
      }
    }
  });

  /**
   участие в вебинаре
   */

  /**
    Событие: join_webinar
    Подключение пользователя (преподавателя или студента) к вебинару
    Обрабатывает:
   Добавление в комнату
   Обновление списка участников
   Оповещение других участников
   Обработку переподключений
    
    Данные: { sessionId, userType, userId, userName }
   */
  socket.on('join_webinar', async (data) => {
    const { sessionId, userType, userId, userName } = data;
    const roomName = `session_${sessionId}`;

    console.log('=== JOIN WEBINAR ===');
    console.log('Socket ID:', socket.id);
    console.log('Data:', { sessionId, userType, userId, userName });
    console.log('Активные комнаты до:', Array.from(sessionParticipants.keys()));

    // Создаем Map для участников, если его еще нет
    if (!sessionParticipants.has(roomName)) {
      sessionParticipants.set(roomName, new Map());
    }

    const participantsMap = sessionParticipants.get(roomName);
    
    // Проверяем, не было ли у пользователя другого подключения (переподключение)
    let existingSocketId = null;
    for (const [sockId, participant] of participantsMap.entries()) {
      if (participant.userId === userId && participant.userType === userType) {
        existingSocketId = sockId;
        break;
      }
    }

    // Если есть существующее подключение, удаляем его
    if (existingSocketId && existingSocketId !== socket.id) {
      console.log(`Пользователь ${userName} (${userType}) переподключается: ${existingSocketId} -> ${socket.id}`);
      
      participantsMap.delete(existingSocketId);
      
      // Оповещаем других об уходе старого подключения
      io.to(roomName).emit('user_left', {
        userType,
        userName,
        socketId: existingSocketId,
        timestamp: new Date(),
        reason: 'reconnected'
      });
      
      // Обновляем список участников
      const updatedParticipants = Array.from(participantsMap.values());
      io.to(roomName).emit('participants_list', updatedParticipants);
    }

    // Добавляем новое подключение
    participantsMap.set(socket.id, {
      userType,
      userId,
      userName,
      socketId: socket.id,
      joinedAt: new Date(),
      isReconnect: !!existingSocketId
    });

    // Обновляем информацию в activeConnections
    activeConnections.set(socket.id, {
      ...activeConnections.get(socket.id),
      sessionId: sessionId,
      userType,
      userId,
      userName,
      room: roomName,
      joinedAt: new Date(),
      isReconnect: !!existingSocketId
    });

    // Добавляем сокет в комнату
    socket.join(roomName);

    // Добавляем в sessionRooms
    if (!sessionRooms.has(roomName)) {
      sessionRooms.set(roomName, new Set());
    }
    sessionRooms.get(roomName).add(socket.id);

    // Отправляем всем обновленный список участников
    const roomParticipants = Array.from(participantsMap.values());
    io.to(roomName).emit('participants_list', roomParticipants);

    // Если это не переподключение, оповещаем других о новом участнике
    if (!existingSocketId) {
      socket.to(roomName).emit('user_joined', {
        userType,
        userName,
        userId,
        socketId: socket.id,
        timestamp: new Date()
      });
    }

    // Специфичная логика для преподавателей и студентов
    if (userType === 'teacher') {
      // Отправляем преподавателю список студентов для мониторинга
      const students = roomParticipants.filter(p => p.userType === 'student');
      socket.emit('students_for_monitoring', students);
    }

    if (userType === 'student') {
      // Сообщаем студенту, если преподаватель уже в комнате
      const teacher = roomParticipants.find(p => p.userType === 'teacher');
      if (teacher) {
        socket.emit('teacher_present', {
          teacherName: teacher.userName,
          teacherSocketId: teacher.socketId
        });
      }
    }

    console.log(`Пользователь ${userName} (${userType}) подключился к сессии ${sessionId}. Всего участников: ${roomParticipants.length}`);
    console.log('Участники в комнате:', roomParticipants.map(p => ({
      name: p.userName,
      type: p.userType,
      socketId: p.socketId
    })));
  });

  /**
    Событие: leave_webinar
    Пользователь покидает вебинар
   Удаляет из всех структур данных и оповещает других
    
    Данные: { sessionId }
   */
  socket.on('leave_webinar', ({ sessionId }) => {
    const connectionInfo = activeConnections.get(socket.id);
    if (!connectionInfo) return;
    
    const { userType, userName, room } = connectionInfo;
    
    console.log(`Пользователь ${userName} (${userType}) покидает вебинар`);
    
    // Удаляем из комнаты, если есть
    if (room && sessionRooms.has(room)) {
      sessionRooms.get(room).delete(socket.id);
      
      if (sessionParticipants.has(room)) {
        const participantsMap = sessionParticipants.get(room);
        participantsMap.delete(socket.id);
        
        const roomParticipants = Array.from(participantsMap.values());
        
        // Оповещаем всех об изменении
        io.to(room).emit('participants_list', roomParticipants);
        io.to(room).emit('user_left', {
          userType,
          userName,
          socketId: socket.id,
          timestamp: new Date()
        });
        
        // Если комната опустела - удаляем её
        if (roomParticipants.length === 0) {
          sessionParticipants.delete(room);
          sessionRooms.delete(room);
        }
      }
    }
    
    activeConnections.delete(socket.id);
    socket.leave(room);
  });

  /**
   Событие: get_participants_list
    Запрос актуального списка участников сессии
    
    Данные: { sessionId }
   */
  socket.on('get_participants_list', ({ sessionId }) => {
    console.log('=== GET PARTICIPANTS LIST ===');
    console.log('Socket ID:', socket.id);
    console.log('Session ID:', sessionId);
    
    const roomName = `session_${sessionId}`;
    console.log('Room name:', roomName);
    console.log('Есть ли комната?', sessionParticipants.has(roomName));
    
    if (sessionParticipants.has(roomName)) {
      const participantsMap = sessionParticipants.get(roomName);
      const roomParticipants = Array.from(participantsMap.values());
      console.log('Участники:', roomParticipants.map(p => ({
        name: p.userName,
        type: p.userType,
        socketId: p.socketId
      })));
      socket.emit('participants_list', roomParticipants);
    } else {
      console.log('Комната не найдена, отправляем пустой список');
      socket.emit('participants_list', []);
    }
  });

  /**
   Событие: send_message
   Отправка сообщения в чат сессии
   Сохраняет сообщение в БД и рассылает всем участникам
    
    Данные: { sessionId, message, senderType, senderId, senderName }
   */
  socket.on('send_message', async (data) => {
    const { sessionId, message, senderType, senderId, senderName } = data;
    const timestamp = new Date();
    
    try {
      // Сохраняем в БД
      await pool.query(
        'INSERT INTO "Message" ("sessionId", "senderType", "senderId", text, "timestamp") VALUES ($1, $2, $3, $4, $5)',
        [sessionId, senderType, senderId, message, timestamp]
      );

      // Рассылаем всем в комнате
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

  /**
   Событие: start_recording
   Уведомление о начале записи аудио
   Рассылается всем участникам сессии
    
    Данные: { sessionId, teacherId, teacherName }
   */
  socket.on('start_recording', ({ sessionId, teacherId, teacherName }) => {
    const roomName = `session_${sessionId}`;
    io.to(roomName).emit('recording_started', {
      teacherId,
      teacherName,
      timestamp: new Date()
    });
  });

  /**
   Событие: stop_recording
   Уведомление об остановке записи аудио
   Рассылается всем участникам сессии
    
   Данные: { sessionId, teacherId, teacherName }
   */
  socket.on('stop_recording', ({ sessionId, teacherId, teacherName }) => {
    const roomName = `session_${sessionId}`;
    io.to(roomName).emit('recording_stopped', {
      teacherId,
      teacherName,
      timestamp: new Date()
    });
  });

  /**
   Событие: student_activity не получилось внедрить !!!!!!!!!!!!!!!!!
   Отслеживание активности студента (например, отвлекся ли он)
    
   Данные: { sessionId, activity }
   */
  // socket.on('student_activity', ({ sessionId, activity }) => {
  //   const studentInfo = activeConnections.get(socket.id);
  //   if (studentInfo && studentInfo.userType === 'student') {
  //     const roomName = `session_${sessionId}`;
  //     socket.to(roomName).emit('student_activity_update', {
  //       studentId: studentInfo.userId,
  //       studentName: studentInfo.userName,
  //       activity,
  //       timestamp: new Date()
  //     });
  //   }
  // });

  /**
   * Событие: disconnect
   * Обработка отключения клиента
   * Очищает все структуры данных и оповещает других
   * 
   * Данные: reason - причина отключения
   */
  socket.on('disconnect', (reason) => {
    const connectionInfo = activeConnections.get(socket.id);
    if (connectionInfo) {
      const { sessionId, userType, userName, room } = connectionInfo;
      
      console.log(`Пользователь отключился: ${userName} (${userType}), причина: ${reason}`);
      
      // Удаляем из всех структур данных
      if (room) {
        if (sessionRooms.has(room)) {
          sessionRooms.get(room).delete(socket.id);
        }
        
        if (sessionParticipants.has(room)) {
          const participantsMap = sessionParticipants.get(room);
          participantsMap.delete(socket.id);
          
          const roomParticipants = Array.from(participantsMap.values());
          io.to(room).emit('participants_list', roomParticipants);
          
          io.to(room).emit('user_left', {
            userType,
            userName,
            socketId: socket.id,
            timestamp: new Date(),
            reason: reason
          });
          
          // Если комната опустела - удаляем
          if (roomParticipants.length === 0) {
            sessionParticipants.delete(room);
            sessionRooms.delete(room);
          }
        }
      }
      
      activeConnections.delete(socket.id);
    }
  });

  /**
   * Событие: error
   * Обработка ошибок WebSocket
   */
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// дополнительные http для websocket

/**
 * GET /api/sessions/:sessionId/info
 * Получение информации о сессии: активна ли, сколько участников, есть ли преподаватель
 * Используется для быстрой проверки статуса без подключения к WebSocket
 * 
 * Параметры URL: sessionId
 * Ответ: { sessionId, isActive, participants, teacherOnline }
 */
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














/**
 * GET /api/server/stats
 * Статистика сервера:
 * - Количество активных соединений
 * - Количество активных сессий
 * - Использование памяти
 * - Количество аудиозаписей в БД
 * 
 *  объект со статистикой
 */
app.get('/api/server/stats', (req, res) => {
  const stats = {
    activeConnections: activeConnections.size,
    activeSessions: sessionParticipants.size,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    audioRecordings: 0
  };

  // Добавляем детальную информацию по сессиям
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

  // Получаем количество аудиозаписей из БД 
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

/**
 * GET /api/health
 * Проверка здоровья сервера
 * Возвращает статус всех компонентов
 * 
 * Ответ: { status, timestamp, uptime, database, audioStorage, audioFilesCount }
 */
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
/**
 * Получение аудиозаписей доступных студенту
 * GET /api/audio/student/:studentId
 * Возвращает все аудиозаписи из сессий, которые посетил студент
 * 
 * Параметры URL: studentId
 * Ответ: массив объектов AudioRecording
 */
app.get('/api/audio/student/:studentId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ar.*, s."startTime" as "sessionDate", c.title as "courseTitle", t.name as "teacherName"
       FROM "AudioRecording" ar
       JOIN "Session" s ON ar."sessionId" = s.id
       JOIN "Course" c ON s."courseId" = c.id
       JOIN "Teacher" t ON c."teacherId" = t.id
       JOIN "Attendance" a ON a."sessionId" = s.id
       WHERE a."studentId" = $1
       ORDER BY ar."createdAt" DESC`,
      [req.params.studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения аудиозаписей студента:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// Запуск сервера
server.listen(PORT, '0.0.0.0', () => {

  console.log('HTTPS сервер запущен на порту:', PORT);
  console.log('Аудио файлы:', audioDir);
  
  // Выводим все доступные сетевые интерфейсы для удобства подключения
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  console.log('\nДоступные сетевые интерфейсы:');
  
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal) {
        console.log(`${interfaceName}: https://${interface.address}:${PORT}`);
      }
    });
  });
  
});

// Обработка завершение процесса

/**
 Обработка SIGTERM (сигнал завершения)
 Используется при graceful shutdown в production (например, в Docker)
 */
process.on('SIGTERM', () => {
  console.log('Получен SIGTERM. Завершение работы...');
  server.close(() => {
    console.log('HTTPS сервер закрыт');
    pool.end(() => {
      console.log('PostgreSQL подключение закрыто');
      process.exit(0);
    });
  });
});

/**
 Обработка SIGINT (Ctrl+C)
 Используется при ручном завершении в development
 */
process.on('SIGINT', () => {
  console.log('Получен SIGINT. Завершение работы...');
  server.close(() => {
    console.log('HTTPS сервер закрыт');
    pool.end(() => {
      console.log('PostgreSQL подключение закрыто');
      process.exit(0);
    });
  });
});

/**
  Обработка необработанных исключений
  Логируем ошибку, но не завершаем процесс
 */
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
});

/**
  Обработка необработанных отклонений промисов
  Логируем ошибку, но не завершаем процесс
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный rejection:', reason);
});