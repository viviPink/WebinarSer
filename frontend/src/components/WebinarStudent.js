import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

const WebinarStudent = ({ sessionId, student, onExit }) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [teacherPresent, setTeacherPresent] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherSocketId, setTeacherSocketId] = useState(null);

  // WebRTC
  const [teacherScreenActive, setTeacherScreenActive] = useState(false);
  const [teacherScreenStream, setTeacherScreenStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenSharingTo, setScreenSharingTo] = useState(null);

  // Входящий запрос на показ экрана
  const [incomingScreenRequest, setIncomingScreenRequest] = useState(null);

  const messagesEndRef = useRef(null);
  const isMountedRef = useRef(true);
  const teacherPcRef = useRef(null);

  // Начать трансляцию по запросу преподавателя
  const startStudentScreenShare = async (teacherSocketId) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: false 
      });
      
      setLocalStream(stream);
      setIsSharingScreen(true);
      setScreenSharingTo(teacherSocketId);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // Добавляем треки экрана
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Создаем оффер
      const offer = await pc.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      });
      await pc.setLocalDescription(offer);

      // Отправляем оффер преподавателю
      if (socketRef.current) {
        socketRef.current.emit('student_webrtc_offer', {
          to: teacherSocketId,
          sdp: offer,
          streamType: 'student_to_teacher',
          sessionId
        });
      }

      // Обработка ICE кандидатов
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected) {
          socketRef.current.emit('webrtc_ice_candidate', { 
            to: teacherSocketId, 
            candidate: event.candidate 
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE состояние (студент -> преподаватель):', pc.iceConnectionState);
      };

      setPeerConnection(pc);
      setIncomingScreenRequest(null);
    } catch (err) {
      console.error('Не удалось начать трансляцию:', err);
      alert('Не удалось получить доступ к экрану');
      setIncomingScreenRequest(null);
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
    setScreenSharingTo(null);
    
    if (socketRef.current && screenSharingTo) {
      socketRef.current.emit('stop_screen_share', {
        sessionId,
        streamType: 'student_to_teacher',
        targetSocketId: screenSharingTo
      });
    }
  };

  // WebRTC обработчики
  const handleTeacherScreenShareStarted = ({ teacherSocketId, teacherName }) => {
    console.log('Преподаватель начал трансляцию экрана');
    setTeacherScreenActive(true);
    setTeacherScreenStream(null);
  };

  const handleTeacherScreenShareStopped = () => {
    console.log('Преподаватель остановил трансляцию экрана');
    setTeacherScreenActive(false);
    setTeacherScreenStream(null);
    
    if (teacherPcRef.current) {
      teacherPcRef.current.close();
      teacherPcRef.current = null;
    }
  };

  // Обработка оффера от преподавателя
  const handleTeacherWebrtcOffer = async ({ from, sdp, streamType }) => {
    if (streamType === 'teacher_to_all') {
      console.log('Получен оффер от преподавателя');
      
      if (teacherPcRef.current) {
        teacherPcRef.current.close();
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.ontrack = (event) => {
        console.log('Получен трек от преподавателя');
        if (event.streams && event.streams[0]) {
          setTeacherScreenStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected) {
          socketRef.current.emit('webrtc_ice_candidate', { 
            to: from, 
            candidate: event.candidate 
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE состояние (студент):', pc.iceConnectionState);
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        // Отправляем ответ преподавателю
        if (socketRef.current) {
          socketRef.current.emit('webrtc_answer', { to: from, sdp: answer });
        }

        teacherPcRef.current = pc;
      } catch (err) {
        console.error('Ошибка обработки оффера преподавателя:', err);
        pc.close();
      }
    }
  };

  const handleWebrtcAnswer = async ({ from, sdp }) => {
    // Ответ от преподавателя на наш оффер (когда мы делимся экраном)
    if (peerConnection && from === screenSharingTo) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error('Ошибка установки remote description:', err);
      }
    }
  };

  const handleWebrtcIceCandidate = ({ from, candidate }) => {
    // ICE кандидаты от преподавателя
    if (teacherPcRef.current && from === teacherSocketId) {
      if (teacherPcRef.current && candidate) {
        try {
          teacherPcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Ошибка добавления ICE кандидата:', err);
        }
      }
    }
    
    // ICE кандидаты от преподавателя для нашего экрана
    if (peerConnection && from === screenSharingTo) {
      if (peerConnection && candidate) {
        try {
          peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Ошибка добавления ICE кандидата:', err);
        }
      }
    }
  };

  // Обработка запроса от преподавателя
  const handleTeacherRequestedStudentScreen = ({ teacherSocketId, teacherName, requestId }) => {
    setIncomingScreenRequest({ 
      teacherSocketId, 
      teacherName, 
      requestId 
    });
  };

  // Обработка остановки просмотра преподавателем
  const handleTeacherStoppedWatching = () => {
    stopStudentScreenShare();
  };

  // Подключение
  useEffect(() => {
    isMountedRef.current = true;
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    setSocket(newSocket);
    socketRef.current = newSocket;

    setConnectionStatus('connecting');

    newSocket.on('connect', () => {
      if (!isMountedRef.current) return;
      console.log('WebSocket подключен');
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
      console.log('WebSocket отключен:', reason);
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      if (!isMountedRef.current) return;
      console.error('Ошибка подключения WebSocket:', error);
      setConnectionStatus('error');
    });

    fetch(`${API_BASE_URL}/api/messages/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (isMountedRef.current) {
          setMessages(data);
        }
      })
      .catch(err => console.error('Ошибка загрузки сообщений:', err));

    return () => {
      isMountedRef.current = false;
      if (socketRef.current?.connected) {
        newSocket.emit('leave_webinar', { sessionId });
        newSocket.disconnect();
      }
      if (peerConnection) peerConnection.close();
      if (teacherPcRef.current) teacherPcRef.current.close();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (teacherScreenStream) teacherScreenStream.getTracks().forEach(t => t.stop());
      socketRef.current = null;
    };
  }, [sessionId, student]);

  // WebSocket события
  useEffect(() => {
    if (!socketRef.current) return;

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
    socketRef.current.on('teacher_screen_share_started', handleTeacherScreenShareStarted);
    socketRef.current.on('teacher_screen_share_stopped', handleTeacherScreenShareStopped);
    socketRef.current.on('teacher_webrtc_offer', handleTeacherWebrtcOffer);
    socketRef.current.on('webrtc_answer', handleWebrtcAnswer);
    socketRef.current.on('webrtc_ice_candidate', handleWebrtcIceCandidate);
    socketRef.current.on('teacher_requested_student_screen', handleTeacherRequestedStudentScreen);
    socketRef.current.on('teacher_stopped_watching', handleTeacherStoppedWatching);

    socketRef.current.on('new_message', handleNewMessage);
    socketRef.current.on('participants_list', handleParticipantsList);
    socketRef.current.on('user_joined', handleUserJoined);
    socketRef.current.on('user_left', handleUserLeft);
    socketRef.current.on('teacher_present', handleTeacherPresent);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('teacher_screen_share_started', handleTeacherScreenShareStarted);
        socketRef.current.off('teacher_screen_share_stopped', handleTeacherScreenShareStopped);
        socketRef.current.off('teacher_webrtc_offer', handleTeacherWebrtcOffer);
        socketRef.current.off('webrtc_answer', handleWebrtcAnswer);
        socketRef.current.off('webrtc_ice_candidate', handleWebrtcIceCandidate);
        socketRef.current.off('teacher_requested_student_screen', handleTeacherRequestedStudentScreen);
        socketRef.current.off('teacher_stopped_watching', handleTeacherStoppedWatching);
        socketRef.current.off('new_message', handleNewMessage);
        socketRef.current.off('participants_list', handleParticipantsList);
        socketRef.current.off('user_joined', handleUserJoined);
        socketRef.current.off('user_left', handleUserLeft);
        socketRef.current.off('teacher_present', handleTeacherPresent);
      }
    };
  }, [peerConnection, teacherSocketId, screenSharingTo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !socketRef.current?.connected) return;
    socketRef.current.emit('send_message', {
      sessionId,
      message: newMessage,
      senderType: 'student',
      senderId: student.id,
      senderName: student.full_name
    });
    setNewMessage('');
  };

  const trackActivity = (activity) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('student_activity', { sessionId, activity });
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8f9fa', position: 'relative' }}>
      {/* Основная область */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflow: 'auto' }}>
        {/* Шапка */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #ddd', backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div>
            <h2 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>Вебинар - Студент</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              {student.full_name} | Группа: {student.group} | Сессия ID: {sessionId}
            </p>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '12px' }}>
              Преподаватель: {teacherPresent ? teacherName : 'Не подключен'} | 
              
            </p>
          </div>
          <button onClick={() => onExit()} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>← Выйти из вебинара</button>
        </div>

        {/* Экран преподавателя */}
        {teacherScreenActive && teacherScreenStream && (
          <div style={{ width: '100%', height: '400px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '12px', backgroundColor: '#080808', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              
              <span>Экран преподавателя: {teacherName}</span>
            </div>
            <video
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: 'calc(100% - 40px)', objectFit: 'contain' }}
              ref={el => { if (el) el.srcObject = teacherScreenStream; }}
            />
          </div>
        )}

        {/* Ваш экран (при трансляции) */}
        {isSharingScreen && localStream && (
          <div style={{ width: '100%', height: '300px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '12px', backgroundColor: '#fd7e14', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              
              <span>Ваш экран (показывается преподавателю)</span>
            </div>
            <video
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: 'calc(100% - 40px)', objectFit: 'contain' }}
              ref={el => { if (el) el.srcObject = localStream; }}
            />
          </div>
        )}

        {/* Информационная панель */}
        <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
          <h4 style={{ color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>Информация о подключении</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Статус подключения:</div>
              <div style={{ color: connectionStatus === 'connected' ? '#233327' : '#dc3545', fontWeight: 'bold', fontSize: '14px' }}>
                {connectionStatus === 'connected' ? ' Подключен' : ' Не подключен'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Преподаватель:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                {teacherPresent ? ` ${teacherName}` : 'Не подключен'}
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
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Экран преподавателя:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: teacherScreenActive ? '#0d110e' : '#6c757d' }}>
                {teacherScreenActive ? 'Показывается' : 'Не активен'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Ваш экран:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: isSharingScreen ? '#fd7e14' : '#6c757d' }}>
                {isSharingScreen ? 'Показывается преподавателю' : 'Не активен'}
              </div>
            </div>
          </div>
          
          {/* Кнопки активности */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={() => trackActivity('active')} style={{ flex: 1, padding: '12px', backgroundColor: '#111313', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>📱 Я активен</button>
            <button onClick={() => { trackActivity('question_asked'); setNewMessage('Вопрос преподавателю: '); }} style={{ flex: 1, padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>❓ Задать вопрос</button>
            <button onClick={() => { trackActivity('need_help'); setNewMessage('Нужна помощь: '); }} style={{ flex: 1, padding: '12px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>🆘 Нужна помощь</button>
          </div>

          {/* Кнопка остановки трансляции */}
          {isSharingScreen && (
            <button 
              onClick={stopStudentScreenShare}
              style={{ 
                marginTop: '15px',
                padding: '12px',
                backgroundColor: '#0a0708',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              Остановить трансляцию своего экрана
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
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{participant.userName}{participant.userType === 'teacher' && ' '}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{participant.userType === 'teacher' ? 'Преподаватель' : 'Студент'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Чат */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Чат вебинара</h4>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', maxHeight: '400px', border: '1px solid #e9ecef' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px', opacity: 0.3 }}></div>
                <p>Начните общение в чате</p>
                <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>Сообщения видны всем участникам вебинара</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={`msg-${index}-${msg.timestamp}`} style={{ marginBottom: '12px', padding: '10px', backgroundColor: msg.senderType === 'teacher' ? '#e7f3ff' : 'white', borderRadius: '8px', borderLeft: `4px solid ${msg.senderType === 'teacher' ? '#007bff' : '#28a745'}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{msg.senderName}{msg.senderType === 'teacher' && ' '}</div>
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
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Введите сообщение" style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }} />
            <button onClick={sendMessage} disabled={!newMessage.trim() || !socketRef.current?.connected} style={{ padding: '12px 20px', backgroundColor: newMessage.trim() && socketRef.current?.connected ? '#030303' : '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: newMessage.trim() && socketRef.current?.connected ? 'pointer' : 'not-allowed', fontWeight: 'bold', minWidth: '100px' }}>Отправить</button>
          </div>
        </div>
      </div>

      {/* Модальное окно запроса */}
      {incomingScreenRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            borderRadius: '12px',
            textAlign: 'center',
            maxWidth: '400px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Запрос на показ экрана</h3>
            <p style={{ marginBottom: '20px' }}>
              Преподаватель просит показать ваш экран.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => startStudentScreenShare(incomingScreenRequest.teacherSocketId)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#040504',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Разрешить
              </button>
              <button
                onClick={() => setIncomingScreenRequest(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebinarStudent;