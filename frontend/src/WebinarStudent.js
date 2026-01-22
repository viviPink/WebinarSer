import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const WebinarStudent = ({ sessionId, student, onExit }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [teacherPresent, setTeacherPresent] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherSocketId, setTeacherSocketId] = useState(null);
  
  // WebRTC
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [teacherScreenActive, setTeacherScreenActive] = useState(false);

  const messagesEndRef = useRef(null);
  const isMountedRef = useRef(true);

  // Создание RTCPeerConnection
  const createPeerConnection = useCallback((socketId, onTrack) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = onTrack;
    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit('webrtc_ice_candidate', { to: socketId, candidate: event.candidate });
      }
    };

    return pc;
  }, [socket]);

  // Отправить свой экран преподавателю
  const startStudentScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setLocalStream(stream);
      setIsSharingScreen(true);

      const pc = createPeerConnection(teacherSocketId, () => {});
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.createOffer();
      await pc.setLocalDescription(pc.localDescription);

      socket.emit('webrtc_offer', {
        to: teacherSocketId,
        sdp: pc.localDescription,
        streamType: 'student_to_teacher',
        sessionId
      });

      setPeerConnection(pc);
    } catch (err) {
      console.error('Не удалось начать трансляцию:', err);
      alert('Не удалось получить доступ к экрану');
    }
  };

  // Остановить трансляцию
  const stopStudentScreenShare = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    setIsSharingScreen(false);
    socket.emit('stop_screen_share', {
      sessionId,
      streamType: 'student_to_teacher',
      targetSocketId: teacherSocketId
    });
  };

  // WebRTC обработчики
  const handleTeacherScreenShareRequested = () => {
    setTeacherScreenActive(true);
  };

  const handleTeacherScreenShareStopped = () => {
    setTeacherScreenActive(false);
    if (remoteStream) {
      remoteStream.getTracks().forEach(t => t.stop());
      setRemoteStream(null);
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
  };

  const handleWebrtcOffer = async ({ from, sdp, streamType }) => {
    if (streamType === 'teacher_to_all') {
      const pc = createPeerConnection(from, (event) => {
        setRemoteStream(event.streams[0]);
      });
      
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc_answer', { to: from, sdp: answer });
      
      setPeerConnection(pc);
    }
  };

  const handleWebrtcAnswer = async ({ from, sdp }) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  };

  const handleWebrtcIceCandidate = ({ from, candidate }) => {
    if (peerConnection) {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  // Подключение
  useEffect(() => {
    isMountedRef.current = true;
    
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    setSocket(newSocket);
    setConnectionStatus('connecting');

    newSocket.on('connect', () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('connected');
      
      newSocket.emit('join_webinar', {
        sessionId,
        userType: 'student',
        userId: student.id,
        userName: student.full_name
      });
    });

    newSocket.on('disconnect', (reason) => {
      if (!isMountedRef.current) return;
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      if (!isMountedRef.current) return;
      setConnectionStatus('error');
    });

    fetch(`http://localhost:3001/api/messages/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (isMountedRef.current) {
          setMessages(data);
        }
      })
      .catch(err => console.error('Ошибка загрузки сообщений:', err));

    return () => {
      isMountedRef.current = false;
      if (newSocket.connected) {
        newSocket.emit('leave_webinar', { sessionId });
        newSocket.disconnect();
      }
      if (peerConnection) peerConnection.close();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (remoteStream) remoteStream.getTracks().forEach(t => t.stop());
    };
  }, [sessionId, student]);

  // WebSocket события
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => setMessages(prev => [...prev, message]);
    const handleParticipantsList = (list) => setParticipants(list);
    const handleUserJoined = (user) => {
      setParticipants(prev => {
        const filtered = prev.filter(p => !(p.userId === user.userId && p.userType === user.userType));
        return [...filtered, user];
      });
      if (user.userType === 'teacher') {
        setTeacherPresent(true);
        setTeacherName(user.userName);
        setTeacherSocketId(user.socketId);
      }
    };
    const handleUserLeft = (user) => {
      setParticipants(prev => prev.filter(p => !(p.socketId === user.socketId)));
      if (user.userType === 'teacher') {
        setTeacherPresent(false);
        setTeacherName('');
        setTeacherSocketId(null);
      }
    };
    const handleTeacherPresent = (data) => {
      setTeacherPresent(true);
      setTeacherName(data.teacherName);
      setTeacherSocketId(data.teacherSocketId);
    };

    // WebRTC
    socket.on('teacher_screen_share_requested', handleTeacherScreenShareRequested);
    socket.on('teacher_screen_share_stopped', handleTeacherScreenShareStopped);
    socket.on('webrtc_offer', handleWebrtcOffer);
    socket.on('webrtc_answer', handleWebrtcAnswer);
    socket.on('webrtc_ice_candidate', handleWebrtcIceCandidate);

    socket.on('new_message', handleNewMessage);
    socket.on('participants_list', handleParticipantsList);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('teacher_present', handleTeacherPresent);

    return () => {
      socket.off('teacher_screen_share_requested', handleTeacherScreenShareRequested);
      socket.off('teacher_screen_share_stopped', handleTeacherScreenShareStopped);
      socket.off('webrtc_offer', handleWebrtcOffer);
      socket.off('webrtc_answer', handleWebrtcAnswer);
      socket.off('webrtc_ice_candidate', handleWebrtcIceCandidate);
      socket.off('new_message', handleNewMessage);
      socket.off('participants_list', handleParticipantsList);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('teacher_present', handleTeacherPresent);
    };
  }, [socket, peerConnection]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !socket?.connected) return;
    socket.emit('send_message', {
      sessionId,
      message: newMessage,
      senderType: 'student',
      senderId: student.id,
      senderName: student.full_name
    });
    setNewMessage('');
  };

  const trackActivity = (activity) => {
    if (socket?.connected) {
      socket.emit('student_activity', { sessionId, activity });
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8f9fa', position: 'relative' }}>
      {/* Основная область */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflow: 'auto' }}>
        {/* Шапка */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #ddd', backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div>
            <h2 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>🎓 Вебинар - Студент</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              {student.full_name} | Группа: {student.group} | Сессия ID: {sessionId}
            </p>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '12px' }}>
              Преподаватель: {teacherPresent ? teacherName : 'Не подключен'} | 
              Статус: {connectionStatus === 'connected' ? '🟢' : '🔴'}
            </p>
          </div>
          <button onClick={() => onExit()} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>← Выйти из вебинара</button>
        </div>

        {/* Экран преподавателя */}
        {teacherScreenActive && remoteStream && (
          <div style={{ width: '100%', height: '400px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
            <video
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              ref={el => { if (el) el.srcObject = remoteStream; }}
            />
          </div>
        )}

        {/* Информационная панель */}
        <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
          <h4 style={{ color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>📋 Информация о подключении</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Статус подключения:</div>
              <div style={{ color: connectionStatus === 'connected' ? '#28a745' : '#dc3545', fontWeight: 'bold', fontSize: '14px' }}>
                {connectionStatus === 'connected' ? '✅ Подключен' : '❌ Не подключен'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Преподаватель:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                {teacherPresent ? `👨‍🏫 ${teacherName}` : '❌ Не подключен'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Участников:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{participants.length}</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Сообщений:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{messages.length}</div>
            </div>
          </div>
          
          {/* Кнопки активности */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={() => trackActivity('active')} style={{ flex: 1, padding: '12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>📱 Я активен</button>
            <button onClick={() => { trackActivity('question_asked'); setNewMessage('❓ Вопрос преподавателю: '); }} style={{ flex: 1, padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>❓ Задать вопрос</button>
            <button onClick={() => { trackActivity('need_help'); setNewMessage('🆘 Нужна помощь: '); }} style={{ flex: 1, padding: '12px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>🆘 Нужна помощь</button>
          </div>

          {/* Кнопка предложения показать экран */}
          {teacherPresent && !isSharingScreen && (
            <button 
              onClick={() => {
                if (socket?.connected) {
                  socket.emit('student_start_screen_share', {
                    sessionId,
                    teacherSocketId
                  });
                }
              }}
              style={{ 
                marginTop: '15px',
                padding: '12px',
                backgroundColor: '#fd7e14',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              🖥️ Предложить показать свой экран преподавателю
            </button>
          )}

          {isSharingScreen && (
            <button 
              onClick={stopStudentScreenShare}
              style={{ 
                marginTop: '15px',
                padding: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              🛑 Остановить трансляцию своего экрана
            </button>
          )}
        </div>
      </div>
      
      {/* Боковая панель */}
      <div style={{ width: '400px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ddd', backgroundColor: 'white', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>
        {/* Участники */}
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fafafa' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
            👥 Участники
            <span style={{ backgroundColor: '#6c757d', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{participants.length}</span>
          </h4>
          <div style={{ marginTop: '10px' }}>
            {participants.map((participant) => (
              <div key={`${participant.userType}-${participant.userId}-${participant.socketId}`} style={{ display: 'flex', alignItems: 'center', padding: '10px', marginBottom: '6px', backgroundColor: participant.userType === 'teacher' ? '#e7f3ff' : '#f8f9fa', borderRadius: '6px', border: participant.userType === 'teacher' ? '1px solid #b3d9ff' : '1px solid #e9ecef' }}>
                <div style={{ width: '8px', height: '8px', backgroundColor: participant.userType === 'teacher' ? '#007bff' : '#28a745', borderRadius: '50%', marginRight: '12px' }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{participant.userName}{participant.userType === 'teacher' && ' 👨‍🏫'}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{participant.userType === 'teacher' ? 'Преподаватель' : 'Студент'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Чат */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>💬 Чат вебинара</h4>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', maxHeight: '400px', border: '1px solid #e9ecef' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px', opacity: 0.3 }}>💬</div>
                <p>Начните общение в чате</p>
                <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>Сообщения видны всем участникам вебинара</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={`msg-${index}-${msg.timestamp}`} style={{ marginBottom: '12px', padding: '10px', backgroundColor: msg.senderType === 'teacher' ? '#e7f3ff' : 'white', borderRadius: '8px', borderLeft: `4px solid ${msg.senderType === 'teacher' ? '#007bff' : '#28a745'}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{msg.senderName}{msg.senderType === 'teacher' && ' 👨‍🏫'}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginLeft: 'auto', backgroundColor: '#f8f9fa', padding: '2px 6px', borderRadius: '10px' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{msg.text}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Введите сообщение..." style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }} />
            <button onClick={sendMessage} disabled={!newMessage.trim() || !socket?.connected} style={{ padding: '12px 20px', backgroundColor: newMessage.trim() && socket?.connected ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: newMessage.trim() && socket?.connected ? 'pointer' : 'not-allowed', fontWeight: 'bold', minWidth: '100px' }}>Отправить</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebinarStudent;