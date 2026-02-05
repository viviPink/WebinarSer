const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const db = {
  // Учителя
  findTeacherByEmail: async (email) => {
    try {
      const result = await pool.query('SELECT * FROM "Teacher" WHERE email = $1', [email]);
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при поиске преподавателя:', error);
      throw error;
    }
  },
  
  createTeacher: async (name, email) => {
    try {
      const result = await pool.query(
        'INSERT INTO "Teacher" (name, email) VALUES ($1, $2) RETURNING *',
        [name, email]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при создании преподавателя:', error);
      throw error;
    }
  },

  // Студенты
  findStudent: async (name, group) => {
    try {
      const result = await pool.query(
        'SELECT * FROM "Student" WHERE "full_name" = $1 AND "group" = $2',
        [name, group]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при поиске студента:', error);
      throw error;
    }
  },

  createStudent: async (name, group) => {
    try {
      const result = await pool.query(
        'INSERT INTO "Student" ("full_name", "group") VALUES ($1, $2) RETURNING *',
        [name, group]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при создании студента:', error);
      throw error;
    }
  },

  // Курсы
  getTeacherCourses: async (teacherId) => {
    try {
      const result = await pool.query(
        'SELECT * FROM "Course" WHERE "teacherId" = $1 ORDER BY id DESC',
        [teacherId]
      );
      return result.rows;
    } catch (error) {
      console.error('Ошибка при получении курсов преподавателя:', error);
      throw error;
    }
  },

  createCourse: async (teacherId, title) => {
    try {
      const result = await pool.query(
        'INSERT INTO "Course" ("teacherId", title) VALUES ($1, $2) RETURNING *',
        [teacherId, title]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при создании курса:', error);
      throw error;
    }
  },

  // Сессии
  createSession: async (courseId) => {
    try {
      const result = await pool.query(
        'INSERT INTO "Session" ("courseId", "isActive", "startTime") VALUES ($1, true, NOW()) RETURNING *',
        [courseId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при создании сессии:', error);
      throw error;
    }
  },

  getTeacherActiveSessions: async (teacherId) => {
    try {
      const result = await pool.query(
        `SELECT s.*, c.title as "courseTitle" 
         FROM "Session" s 
         JOIN "Course" c ON s."courseId" = c.id 
         WHERE c."teacherId" = $1 AND s."isActive" = true
         ORDER BY s."startTime" DESC`,
        [teacherId]
      );
      return result.rows;
    } catch (error) {
      console.error('Ошибка при получении активных сессий преподавателя:', error);
      throw error;
    }
  },

  getAllActiveSessions: async () => {
    try {
      const result = await pool.query(
        `SELECT s.*, c.title as "courseTitle", t.name as "teacherName"
         FROM "Session" s 
         JOIN "Course" c ON s."courseId" = c.id 
         JOIN "Teacher" t ON c."teacherId" = t.id
         WHERE s."isActive" = true
         ORDER BY s."startTime" DESC`
      );
      return result.rows;
    } catch (error) {
      console.error('Ошибка при получении всех активных сессий:', error);
      throw error;
    }
  },

  finishSession: async (sessionId) => {
    try {
      const result = await pool.query(
        'UPDATE "Session" SET "isActive" = false, "endTime" = NOW() WHERE id = $1 RETURNING *',
        [sessionId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при завершении сессии:', error);
      throw error;
    }
  },

  getSessionById: async (sessionId) => {
    try {
      const result = await pool.query(
        `SELECT s.*, c.title as "courseTitle", t.name as "teacherName"
         FROM "Session" s 
         JOIN "Course" c ON s."courseId" = c.id 
         JOIN "Teacher" t ON c."teacherId" = t.id
         WHERE s.id = $1`,
        [sessionId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при получении сессии по ID:', error);
      throw error;
    }
  },

  // Посещаемость
  createAttendance: async (studentId, sessionId) => {
    try {
      const result = await pool.query(
        'INSERT INTO "Attendance" ("studentId", "sessionId", "joinTime") VALUES ($1, $2, NOW()) RETURNING *',
        [studentId, sessionId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при создании записи посещаемости:', error);
      throw error;
    }
  },

  getStudentHistory: async (studentId) => {
    try {
      const result = await pool.query(
        `SELECT s.*, c.title as "courseTitle", t.name as "teacherName", a."joinTime"
         FROM "Attendance" a
         JOIN "Session" s ON a."sessionId" = s.id
         JOIN "Course" c ON s."courseId" = c.id
         JOIN "Teacher" t ON c."teacherId" = t.id
         WHERE a."studentId" = $1
         ORDER BY a."joinTime" DESC`,
        [studentId]
      );
      return result.rows;
    } catch (error) {
      console.error('Ошибка при получении истории студента:', error);
      throw error;
    }
  },

  getAttendanceBySession: async (sessionId) => {
    try {
      const result = await pool.query(
        `SELECT a.*, s."full_name" as "studentName", s."group" as "studentGroup"
         FROM "Attendance" a
         JOIN "Student" s ON a."studentId" = s.id
         WHERE a."sessionId" = $1
         ORDER BY a."joinTime" DESC`,
        [sessionId]
      );
      return result.rows;
    } catch (error) {
      console.error('Ошибка при получении посещаемости по сессии:', error);
      throw error;
    }
  },

  // Сообщения
  createMessage: async (sessionId, senderType, senderId, text, timestamp) => {
    try {
      await pool.query(
        'INSERT INTO "Message" ("sessionId", "senderType", "senderId", text, "timestamp") VALUES ($1, $2, $3, $4, $5)',
        [sessionId, senderType, senderId, text, timestamp]
      );
      return { success: true };
    } catch (error) {
      console.error('Ошибка при создании сообщения:', error);
      throw error;
    }
  },

  getSessionMessages: async (sessionId) => {
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
      return result.rows;
    } catch (error) {
      console.error('Ошибка при получении сообщений сессии:', error);
      throw error;
    }
  },

  getRecentMessages: async (sessionId, limit = 50) => {
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
         ORDER BY m."timestamp" DESC
         LIMIT $2`,
        [sessionId, limit]
      );
      return result.rows.reverse();
    } catch (error) {
      console.error('Ошибка при получении последних сообщений:', error);
      throw error;
    }
  },

  // Аудиозаписи
  createAudioRecording: async (data) => {
    try {
      const result = await pool.query(
        `INSERT INTO "AudioRecording" 
         ("sessionId", "teacherId", "fileName", "filePath", "fileSize", "duration", "title", "description", "transcription") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [
          data.sessionId, 
          data.teacherId, 
          data.fileName, 
          data.filePath, 
          data.fileSize, 
          data.duration, 
          data.title || 'Без названия', 
          data.description || '', 
          data.transcription || ''
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при создании аудиозаписи:', error);
      throw error;
    }
  },

  getSessionRecordings: async (sessionId) => {
    try {
      const result = await pool.query(
        `SELECT ar.*, t.name as "teacherName"
         FROM "AudioRecording" ar
         LEFT JOIN "Teacher" t ON ar."teacherId" = t.id
         WHERE ar."sessionId" = $1
         ORDER BY ar."createdAt" DESC`,
        [sessionId]
      );
      return result.rows;
    } catch (error) {
      console.error('Ошибка при получении аудиозаписей сессии:', error);
      throw error;
    }
  },

  getRecordingById: async (recordingId) => {
    try {
      const result = await pool.query(
        `SELECT ar.*, t.name as "teacherName"
         FROM "AudioRecording" ar
         LEFT JOIN "Teacher" t ON ar."teacherId" = t.id
         WHERE ar.id = $1`,
        [recordingId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при получении аудиозаписи по ID:', error);
      throw error;
    }
  },

  getTeacherRecordings: async (teacherId) => {
    try {
      const result = await pool.query(
        `SELECT ar.*, s."startTime" as "sessionDate", c.title as "courseTitle"
         FROM "AudioRecording" ar
         LEFT JOIN "Session" s ON ar."sessionId" = s.id
         LEFT JOIN "Course" c ON s."courseId" = c.id
         WHERE ar."teacherId" = $1
         ORDER BY ar."createdAt" DESC`,
        [teacherId]
      );
      return result.rows;
    } catch (error) {
      console.error('Ошибка при получении аудиозаписей преподавателя:', error);
      throw error;
    }
  },

  deleteRecording: async (recordingId) => {
    try {
      await pool.query('DELETE FROM "AudioRecording" WHERE id = $1', [recordingId]);
      return { success: true };
    } catch (error) {
      console.error('Ошибка при удалении аудиозаписи:', error);
      throw error;
    }
  },

  updateRecordingTranscription: async (recordingId, transcription) => {
    try {
      await pool.query(
        'UPDATE "AudioRecording" SET "transcription" = $1 WHERE id = $2',
        [transcription, recordingId]
      );
      return { success: true };
    } catch (error) {
      console.error('Ошибка при обновлении транскрипции:', error);
      throw error;
    }
  },

  updateRecordingTitle: async (recordingId, title, description) => {
    try {
      await pool.query(
        'UPDATE "AudioRecording" SET title = $1, description = $2 WHERE id = $3',
        [title, description, recordingId]
      );
      return { success: true };
    } catch (error) {
      console.error('Ошибка при обновлении информации записи:', error);
      throw error;
    }
  },

  getRecordingsCount: async () => {
    try {
      const result = await pool.query('SELECT COUNT(*) as count FROM "AudioRecording"');
      return result.rows[0].count;
    } catch (error) {
      console.error('Ошибка при получении количества записей:', error);
      return '0';
    }
  },

  getMessagesCount: async (sessionId) => {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM "Message" WHERE "sessionId" = $1',
        [sessionId]
      );
      return result.rows[0].count;
    } catch (error) {
      console.error('Ошибка при получении количества сообщений:', error);
      return '0';
    }
  },

  getParticipantsCount: async (sessionId) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(DISTINCT "studentId") as count 
         FROM "Attendance" 
         WHERE "sessionId" = $1`,
        [sessionId]
      );
      return result.rows[0].count;
    } catch (error) {
      console.error('Ошибка при получении количества участников:', error);
      return '0';
    }
  },

  // Статистика
  getSessionStats: async (sessionId) => {
    try {
      const messagesCount = await db.getMessagesCount(sessionId);
      const participantsCount = await db.getParticipantsCount(sessionId);
      const recordingsCount = await pool.query(
        'SELECT COUNT(*) as count FROM "AudioRecording" WHERE "sessionId" = $1',
        [sessionId]
      );

      return {
        messagesCount: parseInt(messagesCount),
        participantsCount: parseInt(participantsCount),
        recordingsCount: parseInt(recordingsCount.rows[0].count),
        lastActivity: new Date()
      };
    } catch (error) {
      console.error('Ошибка при получении статистики сессии:', error);
      throw error;
    }
  },

  getTeacherStats: async (teacherId) => {
    try {
      const sessionsResult = await pool.query(
        'SELECT COUNT(*) as count FROM "Session" s JOIN "Course" c ON s."courseId" = c.id WHERE c."teacherId" = $1',
        [teacherId]
      );

      const recordingsResult = await pool.query(
        'SELECT COUNT(*) as count FROM "AudioRecording" WHERE "teacherId" = $1',
        [teacherId]
      );

      const coursesResult = await pool.query(
        'SELECT COUNT(*) as count FROM "Course" WHERE "teacherId" = $1',
        [teacherId]
      );

      return {
        sessionsCount: parseInt(sessionsResult.rows[0].count),
        recordingsCount: parseInt(recordingsResult.rows[0].count),
        coursesCount: parseInt(coursesResult.rows[0].count)
      };
    } catch (error) {
      console.error('Ошибка при получении статистики преподавателя:', error);
      throw error;
    }
  },

  // Поиск
  searchRecordings: async (teacherId, query) => {
    try {
      const result = await pool.query(
        `SELECT ar.*, s."startTime" as "sessionDate", c.title as "courseTitle"
         FROM "AudioRecording" ar
         LEFT JOIN "Session" s ON ar."sessionId" = s.id
         LEFT JOIN "Course" c ON s."courseId" = c.id
         WHERE ar."teacherId" = $1 
           AND (ar.title ILIKE $2 OR ar.description ILIKE $2 OR ar.transcription ILIKE $2)
         ORDER BY ar."createdAt" DESC`,
        [teacherId, `%${query}%`]
      );
      return result.rows;
    } catch (error) {
      console.error('Ошибка при поиске аудиозаписей:', error);
      throw error;
    }
  },

  // Утилиты
  healthCheck: async () => {
    try {
      await pool.query('SELECT 1');
      return { database: 'ok' };
    } catch (error) {
      console.error('Ошибка при проверке здоровья БД:', error);
      return { database: 'error', message: error.message };
    }
  }
};

// Инициализация таблиц
const initDatabase = async () => {
  try {
    // Таблица AudioRecording
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "AudioRecording" (
        id SERIAL PRIMARY KEY,
        "sessionId" INTEGER NOT NULL,
        "teacherId" INTEGER NOT NULL,
        "fileName" VARCHAR(255) NOT NULL,
        "filePath" VARCHAR(500) NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "duration" INTEGER,
        "title" VARCHAR(255),
        "description" TEXT,
        "transcription" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Таблица AudioRecording создана/проверена');

    // Таблица Message (если еще не существует)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Message" (
        id SERIAL PRIMARY KEY,
        "sessionId" INTEGER NOT NULL,
        "senderType" VARCHAR(50) NOT NULL,
        "senderId" INTEGER NOT NULL,
        "text" TEXT NOT NULL,
        "timestamp" TIMESTAMP DEFAULT NOW(),
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Таблица Message создана/проверена');

    // Таблица Attendance (если еще не существует)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Attendance" (
        id SERIAL PRIMARY KEY,
        "studentId" INTEGER NOT NULL,
        "sessionId" INTEGER NOT NULL,
        "joinTime" TIMESTAMP DEFAULT NOW(),
        "leaveTime" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("studentId", "sessionId")
      )
    `);
    console.log('Таблица Attendance создана/проверена');

    // Таблица Session (если еще не существует)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Session" (
        id SERIAL PRIMARY KEY,
        "courseId" INTEGER NOT NULL,
        "isActive" BOOLEAN DEFAULT true,
        "startTime" TIMESTAMP DEFAULT NOW(),
        "endTime" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Таблица Session создана/проверена');

    // Таблица Course (если еще не существует)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Course" (
        id SERIAL PRIMARY KEY,
        "teacherId" INTEGER NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Таблица Course создана/проверена');

    // Таблица Teacher (если еще не существует)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Teacher" (
        id SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Таблица Teacher создана/проверена');

    // Таблица Student (если еще не существует)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Student" (
        id SERIAL PRIMARY KEY,
        "full_name" VARCHAR(255) NOT NULL,
        "group" VARCHAR(100) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("full_name", "group")
      )
    `);
    console.log('Таблица Student создана/проверена');

    // Создаем индексы для улучшения производительности
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audio_session ON "AudioRecording"("sessionId");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audio_teacher ON "AudioRecording"("teacherId");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_session ON "Message"("sessionId");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_timestamp ON "Message"("timestamp");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_session ON "Attendance"("sessionId");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_session_course ON "Session"("courseId");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_session_active ON "Session"("isActive");
    `);
    
    console.log('Все таблицы и индексы созданы/проверены');

  } catch (err) {
    console.error('Ошибка создания таблиц:', err);
    throw err;
  }
};

// Автоматически инициализируем базу данных при запуске
initDatabase().catch(err => {
  console.error('Ошибка при инициализации базы данных:', err);
});

module.exports = { pool, db };