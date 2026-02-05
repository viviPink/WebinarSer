const { db } = require('./services');

const activeConnections = new Map();
const sessionParticipants = new Map();
const sessionRooms = new Map();

const websocketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);
    
    activeConnections.set(socket.id, {
      socketId: socket.id,
      connectedAt: new Date(),
      room: null
    });

    // Присоединение к вебинару
    socket.on('join_webinar', async (data) => {
      const { sessionId, userType, userId, userName } = data;
      const roomName = `session_${sessionId}`;
      
      if (!sessionParticipants.has(roomName)) {
        sessionParticipants.set(roomName, new Map());
      }
      
      const participantsMap = sessionParticipants.get(roomName);
      
      // Проверка на дублирование
      let existingSocketId = null;
      for (const [sockId, participant] of participantsMap.entries()) {
        if (participant.userId === userId && participant.userType === userType) {
          existingSocketId = sockId;
          break;
        }
      }
      
      // Удаляем старый сокет если есть
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
      
      // Добавляем нового участника
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

    // Отправка сообщения - ИСПРАВЛЕННЫЙ ОБРАБОТЧИК
    socket.on('send_message', async (data) => {
      console.log('Получено сообщение от клиента:', data);
      
      const { sessionId, message, senderType, senderId, senderName } = data;
      const timestamp = new Date();

      try {
        // Сохраняем сообщение в БД
        await db.createMessage(sessionId, senderType, senderId, message, timestamp);

        // Отправляем всем в комнате
        const roomName = `session_${sessionId}`;
        io.to(roomName).emit('new_message', {
          text: message,
          senderType,
          senderName,
          senderId,
          timestamp
        });
        
        console.log('Сообщение отправлено в комнату:', roomName);
      } catch (err) {
        console.error('Ошибка сохранения сообщения:', err);
        socket.emit('message_error', { error: 'Не удалось отправить сообщение' });
      }
    });

    // WebRTC события
    socket.on('teacher_start_screen_share', ({ sessionId }) => {
      const roomName = `session_${sessionId}`;
      const teacherInfo = activeConnections.get(socket.id);
      
      if (teacherInfo?.userType === 'teacher') {
        io.to(roomName).emit('teacher_screen_share_started', {
          teacherSocketId: socket.id,
          teacherName: teacherInfo.userName,
          timestamp: new Date(),
          streamType: 'teacher_to_all'
        });
      }
    });

    socket.on('teacher_send_offer_to_students', ({ sessionId, studentSocketIds, sdp }) => {
      const teacherInfo = activeConnections.get(socket.id);
      if (!teacherInfo || teacherInfo.userType !== 'teacher') return;

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
        socket.emit('error', { message: 'Только преподаватель может запрашивать экран' });
        return;
      }

      const roomName = `session_${sessionId}`;
      const participantsMap = sessionParticipants.get(roomName);
      const studentInfo = participantsMap?.get(studentSocketId);
      
      if (!studentInfo || studentInfo.userType !== 'student') {
        socket.emit('error', { message: 'Студент не найден' });
        return;
      }

      const studentSocket = io.sockets.sockets.get(studentSocketId);
      if (studentSocket) {
        studentSocket.emit('teacher_requested_student_screen', {
          teacherSocketId: socket.id,
          teacherName: teacherInfo.userName,
          sessionId,
          requestId: require('uuid').v4().slice(0, 8)
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

    socket.on('student_webrtc_offer', ({ to, sdp, streamType, sessionId }) => {
      const targetSocket = io.sockets.sockets.get(to);
      if (targetSocket) {
        targetSocket.emit('student_webrtc_offer', { from: socket.id, sdp, streamType, sessionId });
      }
    });

    socket.on('webrtc_offer', ({ to, sdp, streamType, sessionId }) => {
      const targetSocket = io.sockets.sockets.get(to);
      if (targetSocket) {
        targetSocket.emit('webrtc_offer', { from: socket.id, sdp, streamType, sessionId });
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

    // Запрос списка участников
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

    // Начало записи
    socket.on('start_recording', ({ sessionId, teacherId, teacherName }) => {
      const roomName = `session_${sessionId}`;
      io.to(roomName).emit('recording_started', {
        teacherId,
        teacherName,
        timestamp: new Date()
      });
    });

    // Остановка записи
    socket.on('stop_recording', ({ sessionId, teacherId, teacherName }) => {
      const roomName = `session_${sessionId}`;
      io.to(roomName).emit('recording_stopped', {
        teacherId,
        teacherName,
        timestamp: new Date()
      });
    });

    // Активность студента
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

    // Выход из вебинара
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

    // Отключение
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
              reason
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
};

// Экспортируем функции для API
const getSessionInfo = (sessionId) => {
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
  
  return info;
};

const getServerStats = () => {
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
  };
  
  return stats;
};

module.exports = websocketHandler;
module.exports.getSessionInfo = getSessionInfo;
module.exports.getServerStats = getServerStats;