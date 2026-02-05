import React, { useState, useEffect, useRef } from 'react';
// УДАЛИТЕ импорт io, если не используется напрямую
// import io from 'socket.io-client';
import { api, websocket } from '../services/api';

const WebinarTeacherPage = ({ sessionId, teacher, onExit }) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [studentsForMonitoring, setStudentsForMonitoring] = useState([]);
  
  // Аудиозапись
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingDescription, setRecordingDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // WebRTC
  const [localStream, setLocalStream] = useState(null);
  const [isTeacherBroadcasting, setIsTeacherBroadcasting] = useState(false);
  const [activeStudentScreen, setActiveStudentScreen] = useState(null);
  
  const messagesEndRef = useRef(null);
  const timerRef = useRef(null);
  const audioStreamRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Загрузка данных
  useEffect(() => {
    // Загружаем сообщения
    api.getMessages(sessionId).then(setMessages);
    
    // Загружаем записи
    fetchRecordings();
    
    // Подключаем WebSocket
    const connectWebSocket = async () => {
      try {
        console.log('🔄 Начало подключения WebSocket...');
        const socket = websocket.connect();
        
        // Сохраняем сокет в ref и state
        socketRef.current = socket;
        setSocket(socket);
        setConnectionStatus('connecting');
        
        // Обработчики событий WebSocket
        socket.on('connect', () => {
          console.log('✅ WebSocket подключен:', socket.id);
          setConnectionStatus('connected');
          
          socket.emit('join_webinar', {
            sessionId,
            userType: 'teacher',
            userId: teacher.id,
            userName: teacher.name
          });
        });
        
        socket.on('connect_error', (error) => {
          console.error('❌ Ошибка подключения WebSocket:', error);
          setConnectionStatus('error');
        });
        
        socket.on('disconnect', (reason) => {
          console.log('🔌 WebSocket отключен:', reason);
          setConnectionStatus('disconnected');
          
          // Пытаемся переподключиться
          if (reason === 'io server disconnect') {
            setTimeout(() => {
              console.log('🔄 Попытка переподключения...');
              connectWebSocket();
            }, 3000);
          }
        });
        
        socket.on('welcome', (data) => {
          console.log('👋 Приветствие от сервера:', data);
        });
        
        socket.on('new_message', (message) => {
          console.log('📨 Получено новое сообщение:', message);
          setMessages(prev => [...prev, message]);
        });
        
        socket.on('participants_list', (list) => {
          console.log('👥 Получен список участников:', list.length);
          setParticipants(list);
          setStudentsForMonitoring(list.filter(p => p.userType === 'student'));
        });
        
        socket.on('audio_recording_added', (data) => {
          console.log('🎙️ Добавлена новая аудиозапись:', data);
          setRecordings(prev => [data.recording, ...prev]);
        });
        
        socket.on('message_error', (error) => {
          console.error('❌ Ошибка отправки сообщения:', error);
          alert('Не удалось отправить сообщение: ' + (error.error || 'Неизвестная ошибка'));
        });
        
        // Периодически отправляем ping для поддержания соединения
        const pingInterval = setInterval(() => {
          if (socket.connected) {
            socket.emit('ping');
          }
        }, 30000);
        
        // Очистка интервала при размонтировании
        return () => clearInterval(pingInterval);
        
      } catch (error) {
        console.error('❌ Ошибка при подключении WebSocket:', error);
        setConnectionStatus('error');
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (socketRef.current?.connected) {
        console.log('🧹 Очистка WebSocket соединения...');
        socketRef.current.emit('leave_webinar', { sessionId });
        socketRef.current.disconnect();
      }
      if (localStream) localStream.getTracks().forEach(track => track.stop());
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(track => track.stop());
    };
  }, [sessionId, teacher.id, teacher.name]);

  // Функция загрузки записей
  const fetchRecordings = () => {
    api.getSessionRecordings(sessionId)
      .then(data => {
        setRecordings(Array.isArray(data) ? data : []);
      })
      .catch(() => setRecordings([]));
  };

  // Таймер записи
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ========== АУДИОЗАПИСЬ ==========

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      });

      audioStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        setRecordingDuration(recordingTime);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioChunks([blob]);
        setShowSaveModal(true);
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      if (socketRef.current?.connected) {
        socketRef.current.emit('start_recording', {
          sessionId,
          teacherId: teacher.id,
          teacherName: teacher.name
        });
      }
    } catch (err) {
      console.error('Ошибка начала записи:', err);
      alert('Не удалось получить доступ к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit('stop_recording', {
          sessionId,
          teacherId: teacher.id,
          teacherName: teacher.name
        });
      }
    }
  };

  const saveRecording = async () => {
    if (audioChunks.length === 0) {
      alert('Нет данных для сохранения');
      return;
    }

    setUploading(true);
    try {
      const blob = audioChunks[0];
      const formData = new FormData();
      formData.append('audio', blob, `recording_${sessionId}.webm`);
      formData.append('sessionId', sessionId);
      formData.append('teacherId', teacher.id);
      formData.append('title', recordingTitle || `Запись от ${new Date().toLocaleString()}`);
      formData.append('description', recordingDescription);
      formData.append('duration', recordingDuration);

      const response = await api.uploadAudio(formData);
      
      if (response.success) {
        setShowSaveModal(false);
        setRecordingTitle('');
        setRecordingDescription('');
        setAudioChunks([]);
        setRecordingTime(0);
        setRecordingDuration(0);
        
        fetchRecordings();
        alert('Запись успешно сохранена');
      } else {
        throw new Error(response.error || 'Ошибка сохранения');
      }
    } catch (err) {
      console.error('Ошибка сохранения записи:', err);
      alert('Ошибка сохранения записи: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const cancelRecording = () => {
    setShowSaveModal(false);
    setRecordingTitle('');
    setRecordingDescription('');
    setAudioChunks([]);
    setRecordingTime(0);
    setRecordingDuration(0);
  };

  const playRecording = (filePath) => {
    const cleanFilePath = filePath.startsWith('/uploads') ? filePath : `/uploads/audio/${filePath}`;
    const audioUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${cleanFilePath}`;
    
    const audio = new Audio(audioUrl);
    audio.play().catch(err => {
      console.error('Ошибка воспроизведения:', err);
      alert('Не удалось воспроизвести аудио');
    });
  };

  const deleteRecording = async (recordingId) => {
    if (!window.confirm('Удалить эту аудиозапись?')) return;

    try {
      await api.deleteRecording(recordingId);
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
      alert('Запись удалена');
    } catch (err) {
      console.error('Ошибка удаления записи:', err);
      alert('Ошибка удаления записи');
    }
  };

  // ТРАНСКРИБИРОВАНИЕ
  const transcribeRecording = async (recordingId) => {
    try {
      const result = await api.transcribeAudio(recordingId);
      if (result.success) {
        setRecordings(prev => prev.map(rec => 
          rec.id === recordingId 
            ? { ...rec, transcription: result.text }
            : rec
        ));
        alert(`Транскрипция готова! Слов: ${result.wordCount}`);
      } else {
        alert('Ошибка: ' + (result.error || 'неизвестно'));
      }
    } catch (err) {
      console.error('Ошибка транскрибирования:', err);
      alert('Не удалось подключиться к сервису транскрибирования');
    }
  };

  // Сообщения
  const sendMessage = () => {
    if (!newMessage.trim()) {
      console.log('Сообщение пустое');
      return;
    }
    
    const currentSocket = socketRef.current;
    
    if (!currentSocket?.connected) {
      console.log('WebSocket не подключен');
      alert('Нет соединения с сервером. Перезагрузите страницу.');
      return;
    }
    
    console.log('Отправка сообщения:', newMessage);
    
    currentSocket.emit('send_message', {
      sessionId,
      message: newMessage,
      senderType: 'teacher',
      senderId: teacher.id,
      senderName: teacher.name
    });

    setNewMessage('');
  };

  const finishWebinar = () => {
    if (window.confirm('Завершить вебинар')) {
      api.finishSession(sessionId)
        .then(() => onExit())
        .catch(err => console.error('Ошибка завершения сессии:', err));
    }
  };

  // Автоскролл сообщений
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Отображение статуса соединения
  const getConnectionStatusText = () => {
    switch(connectionStatus) {
      case 'connected': return '✓ Подключено';
      case 'connecting': return '↻ Подключение...';
      case 'error': return '✗ Ошибка';
      case 'disconnected': return '✗ Отключено';
      default: return '? Неизвестно';
    }
  };

  const getConnectionStatusColor = () => {
    switch(connectionStatus) {
      case 'connected': return 'green';
      case 'connecting': return 'orange';
      case 'error': return 'red';
      case 'disconnected': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="webinar-container">
      <div className="webinar-main">
        {/* Шапка */}
        <div className="webinar-header">
          <div>
            <h2 className="webinar-title">Вебинар - Преподаватель</h2>
            <p className="webinar-info">
              Сессия ID: {sessionId} | {teacher.name}
            </p>
            <p className="webinar-info" style={{fontSize: '12px', color: '#888', marginTop: '5px'}}>
              Студентов: {studentsForMonitoring.length} | 
              Сообщений: {messages.length} | 
              Записей: {recordings.length} |
              Соединение: <span style={{
                color: getConnectionStatusColor(),
                fontWeight: 'bold'
              }}>
                {getConnectionStatusText()}
              </span>
            </p>
          </div>
          <div className="flex gap-10">
            <button className="button button-danger" onClick={finishWebinar}>Завершить вебинар</button>
            <button className="button button-secondary" onClick={onExit}>Выйти</button>
          </div>
        </div>

        {/* Панель управления */}
        <div className="webinar-controls-panel">
          <div className="controls-row">
            {isRecording ? (
              <>
                <div className="recording-indicator">
                  <div className="recording-dot pulse"></div>
                  <span>Идет запись</span>
                  <span style={{fontWeight: 'bold'}}>{formatTime(recordingTime)}</span>
                </div>
                <button className="button button-secondary" onClick={stopRecording}>Остановить запись</button>
              </>
            ) : (
              <button 
                className="button button-danger" 
                onClick={startRecording}
                disabled={!navigator.mediaDevices?.getUserMedia}
                style={{fontSize: '16px', padding: '12px 24px'}}
              >
                Начать запись голоса
              </button>
            )}

            {isTeacherBroadcasting ? (
              <button className="button button-danger">Остановить трансляцию</button>
            ) : (
              <button className="button button-warning">Начать трансляцию экрана</button>
            )}
          </div>
        </div>

        {/* АУДИОЗАПИСИ */}
        <div className="card mb-20">
          <h3 className="section-title">Аудиозаписи ({recordings.length})</h3>
          {recordings.length === 0 ? (
            <div className="text-center p-20" style={{backgroundColor: '#f8f9fa', borderRadius: '6px'}}>
              <p style={{color: '#666'}}>Нет аудиозаписей</p>
            </div>
          ) : (
            <div className="recordings-list">
              {recordings.map((recording) => (
                <div key={recording.id} className="recording-item">
                  <div className="recording-header">
                    <div style={{flex: 1}}>
                      <div className="recording-title">{recording.title || 'Без названия'}</div>
                      <div className="recording-description">{recording.description || 'Без описания'}</div>
                      <div className="recording-meta">
                        {new Date(recording.createdAt).toLocaleString()} | Длительность: {recording.duration ? formatTime(recording.duration) : 'неизвестно'}
                      </div>
                      
                      {recording.transcription && (
                        <div className="transcription-box">
                          <div className="transcription-label">Текст:</div>
                          <div className="transcription-text">
                            {recording.transcription}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="recording-actions">
                      <button 
                        className="button button-primary"
                        onClick={() => playRecording(recording.filePath)}
                      >
                        Воспроизвести
                      </button>
                      <button 
                        className="button button-danger"
                        onClick={() => deleteRecording(recording.id)}
                      >
                        Удалить
                      </button>
                      <button 
                        className={`button ${recording.transcription ? 'button-secondary' : 'button-warning'}`}
                        onClick={() => transcribeRecording(recording.id)}
                      >
                        {recording.transcription ? 'Текст готов' : 'Распознать'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Боковая панель */}
      <div className="webinar-sidebar">
        {/* Участники */}
        <div className="participants-panel">
          <h4 className="participants-title">
            Участники <span className="participant-count">{participants.length}</span>
          </h4>
          <div className="participant-list">
            {participants.map((participant) => (
              <div key={participant.socketId} className={`participant-item ${participant.userType === 'teacher' ? 'teacher' : ''}`}>
                <div className={`participant-dot ${participant.userType === 'teacher' ? 'teacher' : ''}`}></div>
                <div style={{flex: 1}}>
                  <div className="participant-name">{participant.userName}{participant.userType === 'teacher' && ' (Вы)'}</div>
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
                    <div className="message-sender">
                      {msg.senderName}{msg.senderType === 'teacher' && ' (Вы)'}
                    </div>
                    <div className="message-time">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                    </div>
                  </div>
                  <div className="message-text">{msg.text || msg.message}</div>
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
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Введите сообщение..." 
            />
            <button 
              className="button button-primary"
              onClick={sendMessage} 
              disabled={!newMessage.trim() || connectionStatus !== 'connected'}
              style={{
                opacity: (!newMessage.trim() || connectionStatus !== 'connected') ? 0.5 : 1,
                cursor: (!newMessage.trim() || connectionStatus !== 'connected') ? 'not-allowed' : 'pointer'
              }}
            >
              {connectionStatus !== 'connected' ? 'Нет соединения' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно сохранения записи */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">Сохранить аудиозапись</h3>
            <div className="form-group">
              <label className="label">Название записи:</label>
              <input 
                type="text" 
                className="input"
                value={recordingTitle} 
                onChange={(e) => setRecordingTitle(e.target.value)} 
                placeholder="Введите название записи" 
              />
            </div>
            <div className="form-group">
              <label className="label">Описание (необязательно):</label>
              <textarea 
                className="input"
                value={recordingDescription} 
                onChange={(e) => setRecordingDescription(e.target.value)} 
                placeholder="Введите описание записи" 
                rows="3" 
                style={{resize: 'vertical'}}
              />
            </div>
            <div className="card mb-20">
              <div><strong>Информация о записи:</strong></div>
              <div style={{marginTop: '5px'}}>Длительность: {formatTime(recordingDuration)}</div>
            </div>
            <div className="modal-actions">
              <button 
                className="button button-secondary"
                onClick={cancelRecording} 
                disabled={uploading}
              >
                Отмена
              </button>
              <button 
                className={`button ${uploading || !recordingTitle.trim() ? 'button-secondary' : 'button-success'}`}
                onClick={saveRecording} 
                disabled={uploading || !recordingTitle.trim()}
              >
                {uploading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebinarTeacherPage;