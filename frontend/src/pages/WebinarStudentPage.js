import React, { useState, useEffect, useRef } from 'react';

import { api, websocket } from '../services/api';

const WebinarStudentPage = ({ sessionId, student, onExit }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
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
  const [incomingScreenRequest, setIncomingScreenRequest] = useState(null);
  
  const messagesEndRef = useRef(null);
  const teacherPcRef = useRef(null);

  // Загрузка данных
  useEffect(() => {
    api.getMessages(sessionId).then(setMessages);
    
    const socket = websocket.connect();
    setSocket(socket);
    
    socket.on('connect', () => {
      socket.emit('join_webinar', {
        sessionId,
        userType: 'student',
        userId: student.id,
        userName: student.full_name
      });
    });
    
    socket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    socket.on('participants_list', (list) => {
      setParticipants(list);
      const teacher = list.find(p => p.userType === 'teacher');
      if (teacher) {
        setTeacherPresent(true);
        setTeacherName(teacher.userName);
        setTeacherSocketId(teacher.socketId);
      }
    });
    
    socket.on('teacher_present', (data) => {
      setTeacherPresent(true);
      setTeacherName(data.teacherName);
      setTeacherSocketId(data.teacherSocketId);
    });
    
    socket.on('teacher_screen_share_started', ({ teacherSocketId, teacherName }) => {
      setTeacherScreenActive(true);
    });
    
    socket.on('teacher_screen_share_stopped', () => {
      setTeacherScreenActive(false);
      setTeacherScreenStream(null);
      if (teacherPcRef.current) {
        teacherPcRef.current.close();
        teacherPcRef.current = null;
      }
    });
    
    socket.on('teacher_webrtc_offer', async ({ from, sdp, streamType }) => {
      if (streamType === 'teacher_to_all') {
        if (teacherPcRef.current) teacherPcRef.current.close();

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setTeacherScreenStream(event.streams[0]);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && socket?.connected) {
            socket.emit('webrtc_ice_candidate', { 
              to: from, 
              candidate: event.candidate 
            });
          }
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          if (socket) {
            socket.emit('webrtc_answer', { to: from, sdp: answer });
          }

          teacherPcRef.current = pc;
        } catch (err) {
          console.error('Ошибка обработки оффера преподавателя:', err);
          pc.close();
        }
      }
    });
    
    socket.on('teacher_requested_student_screen', ({ teacherSocketId, teacherName, requestId }) => {
      setIncomingScreenRequest({ teacherSocketId, teacherName, requestId });
    });
    
    socket.on('teacher_stopped_watching', () => {
      stopStudentScreenShare();
    });
    
    return () => {
      if (socket?.connected) {
        socket.emit('leave_webinar', { sessionId });
        socket.disconnect();
      }
      if (peerConnection) peerConnection.close();
      if (teacherPcRef.current) teacherPcRef.current.close();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (teacherScreenStream) teacherScreenStream.getTracks().forEach(t => t.stop());
    };
  }, [sessionId, student]);

  // WebRTC функции
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
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      });
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit('student_webrtc_offer', {
          to: teacherSocketId,
          sdp: offer,
          streamType: 'student_to_teacher',
          sessionId
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket?.connected) {
          socket.emit('webrtc_ice_candidate', { 
            to: teacherSocketId, 
            candidate: event.candidate 
          });
        }
      };

      setPeerConnection(pc);
      setIncomingScreenRequest(null);
    } catch (err) {
      console.error('Не удалось начать трансляцию:', err);
      alert('Не удалось получить доступ к экрану');
      setIncomingScreenRequest(null);
    }
  };

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
    
    if (socket && screenSharingTo) {
      socket.emit('stop_screen_share', {
        sessionId,
        streamType: 'student_to_teacher',
        targetSocketId: screenSharingTo
      });
    }
  };

  // Сообщения
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="webinar-container">
      <div className="webinar-main">
        {/* Шапка */}
        <div className="webinar-header">
          <div>
            <h2 className="webinar-title">Вебинар - Студент</h2>
            <p className="webinar-info">
              {student.full_name} | Группа: {student.group} | Сессия ID: {sessionId}
            </p>
            <p className="webinar-info" style={{fontSize: '12px', color: '#888', marginTop: '5px'}}>
              Преподаватель: {teacherPresent ? teacherName : 'Не подключен'}
            </p>
          </div>
          <button className="button button-secondary" onClick={onExit}>← Выйти из вебинара</button>
        </div>

        {/* Экран преподавателя */}
        {teacherScreenActive && teacherScreenStream && (
          <div className="screen-share-container">
            <div className="screen-share-header">
              <span>Экран преподавателя: {teacherName}</span>
            </div>
            <video
              autoPlay
              playsInline
              muted
              className="screen-share-video"
              ref={el => { if (el) el.srcObject = teacherScreenStream; }}
            />
          </div>
        )}

        {/* Ваш экран (при трансляции) */}
        {isSharingScreen && localStream && (
          <div className="screen-share-container" style={{borderColor: '#fd7e14'}}>
            <div className="screen-share-header" style={{backgroundColor: '#fd7e14'}}>
              <span>Ваш экран (показывается преподавателю)</span>
            </div>
            <video
              autoPlay
              playsInline
              muted
              className="screen-share-video"
              ref={el => { if (el) el.srcObject = localStream; }}
            />
          </div>
        )}

        {/* Информационная панель */}
        <div className="card mb-20">
          <h4 className="section-title">Информация о подключении</h4>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px'}} className="mb-20">
            <div className="card">
              <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Статус подключения:</div>
              <div style={{color: socket?.connected ? '#28a745' : '#dc3545', fontWeight: 'bold', fontSize: '14px'}}>
                {socket?.connected ? 'Подключен' : 'Не подключен'}
              </div>
            </div>
            <div className="card">
              <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Преподаватель:</div>
              <div style={{fontWeight: 'bold', fontSize: '14px'}}>
                {teacherPresent ? teacherName : 'Не подключен'}
              </div>
            </div>
            <div className="card">
              <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Участников:</div>
              <div style={{fontWeight: 'bold', fontSize: '14px'}}>{participants.length}</div>
            </div>
            <div className="card">
              <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Сообщений:</div>
              <div style={{fontWeight: 'bold', fontSize: '14px'}}>{messages.length}</div>
            </div>
            <div className="card">
              <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Экран преподавателя:</div>
              <div style={{fontWeight: 'bold', fontSize: '14px', color: teacherScreenActive ? '#28a745' : '#6c757d'}}>
                {teacherScreenActive ? 'Показывается' : 'Не активен'}
              </div>
            </div>
            <div className="card">
              <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>Ваш экран:</div>
              <div style={{fontWeight: 'bold', fontSize: '14px', color: isSharingScreen ? '#fd7e14' : '#6c757d'}}>
                {isSharingScreen ? 'Показывается преподавателю' : 'Не активен'}
              </div>
            </div>
          </div>
          
          {/* Кнопки активности */}
          <div className="flex gap-10 mt-20">
            <button 
              className="button button-primary w-100"
              onClick={() => trackActivity('active')}
            >
              📱 Я активен
            </button>
            <button 
              className="button button-success w-100"
              onClick={() => { trackActivity('question_asked'); setNewMessage('Вопрос преподавателю: '); }}
            >
              ❓ Задать вопрос
            </button>
            <button 
              className="button button-warning w-100"
              onClick={() => { trackActivity('need_help'); setNewMessage('Нужна помощь: '); }}
            >
              🆘 Нужна помощь
            </button>
          </div>

          {/* Кнопка остановки трансляции */}
          {isSharingScreen && (
            <button 
              className="button button-danger w-100 mt-15"
              onClick={stopStudentScreenShare}
            >
              Остановить трансляцию своего экрана
            </button>
          )}
        </div>
      </div>
      
      {/* Боковая панель */}
      <div className="webinar-sidebar">
        {/* Участники */}
        <div className="participants-panel">
          <h4 className="participants-title">
            👥 Участники <span className="participant-count">{participants.length}</span>
          </h4>
          <div className="participant-list">
            {participants.map((participant) => (
              <div key={participant.socketId} className={`participant-item ${participant.userType === 'teacher' ? 'teacher' : ''}`}>
                <div className={`participant-dot ${participant.userType === 'teacher' ? 'teacher' : ''}`}></div>
                <div style={{flex: 1}}>
                  <div className="participant-name">{participant.userName}</div>
                  <div className="participant-role">{participant.userType === 'teacher' ? 'Преподаватель' : 'Студент'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Чат */}
        <div className="chat-panel">
          <h4 className="chat-title">Чат вебинара</h4>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p>Начните общение в чате</p>
                <p style={{fontSize: '12px', color: '#999', marginTop: '10px'}}>Сообщения видны всем участникам вебинара</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.senderType === 'teacher' ? 'teacher' : ''}`}>
                  <div className="message-header">
                    <div className="message-sender">{msg.senderName}</div>
                    <div className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  <div className="message-text">{msg.text}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-container">
            <input 
              type="text" 
              className="input chat-input"
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
              placeholder="Введите сообщение" 
            />
            <button 
              className="button button-primary"
              onClick={sendMessage} 
              disabled={!newMessage.trim() || !socket?.connected}
            >
              Отправить
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно запроса */}
      {incomingScreenRequest && (
        <div className="modal-overlay">
          <div className="modal text-center">
            <h3 className="modal-title">Запрос на показ экрана</h3>
            <p className="mb-20">
              Преподаватель просит показать ваш экран.
            </p>
            <div className="flex gap-12 justify-center">
              <button
                className="button button-success"
                onClick={() => startStudentScreenShare(incomingScreenRequest.teacherSocketId)}
              >
                Разрешить
              </button>
              <button
                className="button button-danger"
                onClick={() => setIncomingScreenRequest(null)}
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

export default WebinarStudentPage;