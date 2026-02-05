const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

// API методы
export const api = {
  // Авторизация
  loginTeacher: async (name, email) => {
    const response = await fetch(`${API_URL}/api/teacher/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    if (!response.ok) throw new Error('Ошибка сервера');
    return response.json();
  },
  
  loginStudent: async (name, group) => {
    const response = await fetch(`${API_URL}/api/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, group })
    });
    if (!response.ok) throw new Error('Ошибка сервера');
    return response.json();
  },
  
  // Курсы
  getTeacherCourses: async (teacherId) => {
    const response = await fetch(`${API_URL}/api/teacher/${teacherId}/courses`);
    if (!response.ok) throw new Error('Ошибка загрузки курсов');
    return response.json();
  },
  
  createCourse: async (teacherId, title) => {
    const response = await fetch(`${API_URL}/api/teacher/courses/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId, title })
    });
    if (!response.ok) throw new Error('Ошибка создания курса');
    return response.json();
  },
  
  // Сессии
  getActiveSessions: async () => {
    const response = await fetch(`${API_URL}/api/sessions/active`);
    if (!response.ok) throw new Error('Ошибка загрузки сессий');
    return response.json();
  },
  
  getTeacherActiveSessions: async (teacherId) => {
    const response = await fetch(`${API_URL}/api/teacher/${teacherId}/sessions/active`);
    if (!response.ok) throw new Error('Ошибка загрузки сессий');
    return response.json();
  },
  
  createSession: async (courseId) => {
    const response = await fetch(`${API_URL}/api/teacher/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId })
    });
    if (!response.ok) throw new Error('Ошибка создания сессии');
    return response.json();
  },
  
  finishSession: async (sessionId) => {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/finish`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Ошибка завершения сессии');
    return response.json();
  },
  
  joinSession: async (studentName, groupName, sessionId) => {
    const response = await fetch(`${API_URL}/api/attendance/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName, groupName, sessionId })
    });
    if (!response.ok) throw new Error('Ошибка присоединения');
    return response.json();
  },
  
  // Аудио
  uploadAudio: async (formData) => {
    const response = await fetch(`${API_URL}/api/audio/upload`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error('Ошибка загрузки файла');
    return response.json();
  },
  
  getSessionRecordings: async (sessionId) => {
    const response = await fetch(`${API_URL}/api/audio/session/${sessionId}`);
    if (!response.ok) throw new Error('Ошибка загрузки записей');
    return response.json();
  },
  
  deleteRecording: async (recordingId) => {
    const response = await fetch(`${API_URL}/api/audio/${recordingId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Ошибка удаления');
    return response.json();
  },
  
  transcribeAudio: async (recordingId) => {
    const response = await fetch(`${API_URL}/api/audio/${recordingId}/transcribe`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Ошибка транскрибирования');
    return response.json();
  },
  
  // Сообщения
  getMessages: async (sessionId) => {
    const response = await fetch(`${API_URL}/api/messages/${sessionId}`);
    if (!response.ok) throw new Error('Ошибка загрузки сообщений');
    return response.json();
  }
};

// WebSocket сервис
let socketInstance = null;

export const websocket = {
  connect: (url = SOCKET_URL) => {
    if (socketInstance) return socketInstance;
    
    const io = require('socket.io-client');
    socketInstance = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    return socketInstance;
  },
  
  disconnect: () => {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
  }
};