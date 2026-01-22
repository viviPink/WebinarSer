import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

const WebinarTeacher = ({ sessionId, teacher, onExit }) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [studentsForMonitoring, setStudentsForMonitoring] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

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

  // Транскрибирование
  const [transcriptions, setTranscriptions] = useState({});
  const [transcribing, setTranscribing] = useState({});

  // WebRTC
  const [localStream, setLocalStream] = useState(null);
  const [studentScreenStreams, setStudentScreenStreams] = useState(new Map());
  const [peerConnections, setPeerConnections] = useState(new Map());
  const [isTeacherBroadcasting, setIsTeacherBroadcasting] = useState(false);
  const [activeStudentScreen, setActiveStudentScreen] = useState(null);
  const [pendingScreenRequests, setPendingScreenRequests] = useState([]);

  const messagesEndRef = useRef(null);
  const isMountedRef = useRef(true);
  const timerRef = useRef(null);
  const audioStreamRef = useRef(null);
  const teacherPcRef = useRef(null);

  // Начать трансляцию экрана (всем студентам)
  const startTeacherScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: false 
      });
      
      setLocalStream(stream);
      setIsTeacherBroadcasting(true);

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

      const studentSocketIds = studentsForMonitoring.map(s => s.socketId);

      if (socketRef.current) {
        socketRef.current.emit('teacher_send_offer_to_students', {
          sessionId,
          studentSocketIds,
          sdp: offer
        });
      }

      teacherPcRef.current = pc;

      if (socketRef.current) {
        socketRef.current.emit('teacher_start_screen_share', { 
          sessionId,
          streamType: 'teacher_to_all' 
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected) {
          studentSocketIds.forEach(studentSocketId => {
            socketRef.current.emit('webrtc_ice_candidate', { 
              to: studentSocketId, 
              candidate: event.candidate 
            });
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE состояние преподавателя:', pc.iceConnectionState);
      };

    } catch (err) {
      console.error('Не удалось начать трансляцию:', err);
      alert('Не удалось получить доступ к экрану');
      setIsTeacherBroadcasting(false);
    }
  };

  // Остановить трансляцию
  const stopTeacherScreenShare = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (teacherPcRef.current) {
      teacherPcRef.current.close();
      teacherPcRef.current = null;
    }

    setIsTeacherBroadcasting(false);

    if (socketRef.current) {
      socketRef.current.emit('stop_screen_share', {
        sessionId,
        streamType: 'teacher_to_all'
      });
    }
  };

  // Запросить экран у студента
  const requestStudentScreen = async (studentSocketId, studentName) => {
    if (!socketRef.current?.connected) {
      alert('Нет подключения к вебинару');
      return;
    }

    if (activeStudentScreen) {
      stopWatchingStudentScreen();
    }

    socketRef.current.emit('teacher_request_student_screen', {
      sessionId,
      studentSocketId
    });

    setActiveStudentScreen({
      studentSocketId,
      studentName,
      requestedAt: new Date()
    });

    setPendingScreenRequests(prev => [...prev, {
      studentSocketId,
      studentName,
      requestedAt: new Date()
    }]);
  };

  // Остановить просмотр экрана студента
  const stopWatchingStudentScreen = () => {
    if (activeStudentScreen) {
      socketRef.current.emit('stop_screen_share', {
        sessionId,
        streamType: 'student_screen_share',
        targetSocketId: activeStudentScreen.studentSocketId
      });
      
      const pc = peerConnections.get(activeStudentScreen.studentSocketId);
      if (pc) {
        pc.close();
        setPeerConnections(prev => {
          const newMap = new Map(prev);
          newMap.delete(activeStudentScreen.studentSocketId);
          return newMap;
        });
      }
      
      setStudentScreenStreams(prev => {
        const newMap = new Map(prev);
        newMap.delete(activeStudentScreen.studentSocketId);
        return newMap;
      });
      
      setActiveStudentScreen(null);
    }
  };

  // WebRTC обработчики
  const handleStudentScreenShareStopped = ({ studentSocketId }) => {
    setStudentScreenStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(studentSocketId);
      return newMap;
    });
    
    setActiveStudentScreen(null);
    
    const pc = peerConnections.get(studentSocketId);
    if (pc) {
      pc.close();
      setPeerConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(studentSocketId);
        return newMap;
      });
    }
  };

  const handleWebrtcAnswer = async ({ from, sdp }) => {
    const pc = teacherPcRef.current;
    if (pc && pc.signalingState !== 'closed') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error('Ошибка установки remote description:', err);
      }
    }
  };

  const handleWebrtcIceCandidate = ({ from, candidate }) => {
    const pc = teacherPcRef.current;
    if (pc && candidate) {
      try {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Ошибка добавления ICE кандидата:', err);
      }
    }
  };

  const handleStudentWebrtcOffer = async ({ from, sdp, streamType }) => {
    if (streamType === 'student_to_teacher') {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setStudentScreenStreams(prev => {
            const newMap = new Map(prev);
            newMap.set(from, event.streams[0]);
            return newMap;
          });
          
          setPendingScreenRequests(prev => 
            prev.filter(req => req.studentSocketId !== from)
          );
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current?.connected) {
          socketRef.current.emit('webrtc_ice_candidate', { to: from, candidate: event.candidate });
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        if (socketRef.current) {
          socketRef.current.emit('webrtc_answer', { to: from, sdp: answer });
        }

        setPeerConnections(prev => {
          const newMap = new Map(prev);
          newMap.set(from, pc);
          return newMap;
        });
      } catch (err) {
        console.error('Ошибка обработки оффера студента:', err);
        pc.close();
      }
    }
  };

  // Основной useEffect
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
      setConnectionStatus('connected');
      newSocket.emit('join_webinar', {
        sessionId,
        userType: 'teacher',
        userId: teacher.id,
        userName: teacher.name
      });
    });

    newSocket.on('disconnect', () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('error');
    });

    fetch(`${API_BASE_URL}/api/messages/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (isMountedRef.current) {
          setMessages(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => setMessages([]));

    fetch(`${API_BASE_URL}/api/audio/session/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (isMountedRef.current) {
          setRecordings(data);
        }
      })
      .catch(() => setRecordings([]));

    return () => {
      isMountedRef.current = false;
      if (socketRef.current?.connected) {
        socketRef.current.emit('leave_webinar', { sessionId });
        socketRef.current.disconnect();
      }
      stopTeacherScreenShare();
      stopWatchingStudentScreen();
    };
  }, [sessionId, teacher.id, teacher.name]);

  // WebSocket обработчики
  useEffect(() => {
    if (!socketRef.current) return;

    const handleNewMessage = (message) => setMessages(prev => [...prev, message]);
    const handleParticipantsList = (list) => {
      setParticipants(list);
      setStudentsForMonitoring(list.filter(p => p.userType === 'student'));
    };
    const handleUserJoined = (user) => {
      setParticipants(prev => {
        const filtered = prev.filter(p => !(p.userId === user.userId && p.userType === user.userType));
        return [...filtered, user];
      });
      if (user.userType === 'student') {
        setStudentsForMonitoring(prev => {
          const filtered = prev.filter(s => !(s.userId === user.userId));
          return [...filtered, user];
        });
      }
    };
    const handleUserLeft = (user) => {
      setParticipants(prev => prev.filter(p => !(p.socketId === user.socketId)));
      if (user.userType === 'student') {
        setStudentsForMonitoring(prev => prev.filter(s => !(s.socketId === user.socketId)));
        if (activeStudentScreen?.studentSocketId === user.socketId) {
          setActiveStudentScreen(null);
          setStudentScreenStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(user.socketId);
            return newMap;
          });
        }
      }
    };
    const handleAudioRecordingAdded = (data) => {
      setRecordings(prev => [data.recording, ...prev]);
    };

    socketRef.current.on('student_screen_share_stopped', handleStudentScreenShareStopped);
    socketRef.current.on('webrtc_answer', handleWebrtcAnswer);
    socketRef.current.on('webrtc_ice_candidate', handleWebrtcIceCandidate);
    socketRef.current.on('student_webrtc_offer', handleStudentWebrtcOffer);
    socketRef.current.on('new_message', handleNewMessage);
    socketRef.current.on('participants_list', handleParticipantsList);
    socketRef.current.on('user_joined', handleUserJoined);
    socketRef.current.on('user_left', handleUserLeft);
    socketRef.current.on('audio_recording_added', handleAudioRecordingAdded);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('student_screen_share_stopped', handleStudentScreenShareStopped);
        socketRef.current.off('webrtc_answer', handleWebrtcAnswer);
        socketRef.current.off('webrtc_ice_candidate', handleWebrtcIceCandidate);
        socketRef.current.off('student_webrtc_offer', handleStudentWebrtcOffer);
        socketRef.current.off('new_message', handleNewMessage);
        socketRef.current.off('participants_list', handleParticipantsList);
        socketRef.current.off('user_joined', handleUserJoined);
        socketRef.current.off('user_left', handleUserLeft);
        socketRef.current.off('audio_recording_added', handleAudioRecordingAdded);
      }
    };
  }, [peerConnections, activeStudentScreen]);

  // Таймер записи
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Аудиозапись
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
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
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

      const response = await fetch(`${API_BASE_URL}/api/audio/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Ошибка загрузки файла');

      const result = await response.json();
      console.log('Запись сохранена:', result);

      setShowSaveModal(false);
      setRecordingTitle('');
      setRecordingDescription('');
      setAudioChunks([]);
      setRecordingTime(0);
      setRecordingDuration(0);

      alert('Запись успешно сохранена!');
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
    const audioUrl = `${API_BASE_URL}${filePath}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(err => console.error('Ошибка воспроизведения:', err));
  };

  const deleteRecording = async (recordingId) => {
    if (!window.confirm('Удалить эту аудиозапись?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/audio/${recordingId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Ошибка удаления');

      setRecordings(prev => prev.filter(r => r.id !== recordingId));
      alert('Запись удалена');
    } catch (err) {
      console.error('Ошибка удаления записи:', err);
      alert('Ошибка удаления записи');
    }
  };

  // Транскрибирование
  const transcribeRecording = async (recordingId) => {
    if (transcribing[recordingId]) return;

    try {
      setTranscribing(prev => ({ ...prev, [recordingId]: true }));

      const response = await fetch(`${API_BASE_URL}/api/audio/${recordingId}/transcribe`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setTranscriptions(prev => ({
          ...prev,
          [recordingId]: result.text
        }));
      } else {
        alert('Ошибка транскрибирования: ' + (result.error || 'неизвестно'));
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert('Не удалось подключиться к сервису транскрибирования');
    } finally {
      setTranscribing(prev => ({ ...prev, [recordingId]: false }));
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !socketRef.current?.connected) return;

    socketRef.current.emit('send_message', {
      sessionId,
      message: newMessage,
      senderType: 'teacher',
      senderId: teacher.id,
      senderName: teacher.name
    });

    setNewMessage('');
  };

  const finishWebinar = () => {
    if (window.confirm('Завершить вебинар? Все подключенные студенты будут отключены.')) {
      fetch(`${API_BASE_URL}/api/sessions/${sessionId}/finish`, { method: 'POST' })
        .then(() => {
          onExit();
        })
        .catch(err => console.error('Ошибка завершения сессии:', err));
    }
  };

  const renderStudentWithControls = (student) => (
    <div key={`student-${student.userId}-${student.socketId}`} style={{ 
      padding: '15px',
      backgroundColor: '#f8f9fa',
      borderRadius: '6px',
      border: '1px solid #dee2e6'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{
          width: '10px',
          height: '10px',
          backgroundColor: '#28a745',
          borderRadius: '50%',
          marginRight: '10px'
        }}></div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '16px' }}>{student.userName}</strong>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            ID: {student.userId}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button 
          onClick={() => setNewMessage(`@${student.userName} `)}
          style={{ padding: '6px 12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
        >
          Написать
        </button>
        <button 
          onClick={() => requestStudentScreen(student.socketId, student.userName)}
          disabled={activeStudentScreen?.studentSocketId === student.socketId}
          style={{ 
            padding: '6px 12px', 
            backgroundColor: activeStudentScreen?.studentSocketId === student.socketId ? '#6c757d' : '#fd7e14', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            fontSize: '12px', 
            cursor: activeStudentScreen?.studentSocketId === student.socketId ? 'not-allowed' : 'pointer' 
          }}
        >
          {activeStudentScreen?.studentSocketId === student.socketId ? 'Смотрит экран' : '🖥️ Запросить экран'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8f9fa' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
        {/* Шапка */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div>
            <h2 style={{ margin: 0, color: '#333' }}>Вебинар - Преподаватель</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              Сессия ID: {sessionId} | Участников: {participants.length}
            </p>
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '12px' }}>
              Статус: {connectionStatus === 'connected' ? '🟢' : '🔴'} |
              Студентов: {studentsForMonitoring.length} |
              Трансляция: {isTeacherBroadcasting ? '🟢 Включена' : '⚫ Выключена'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={finishWebinar} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Завершить вебинар</button>
            <button onClick={() => onExit()} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Выйти</button>
          </div>
        </div>

        {/* Панель управления */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#333', marginBottom: '15px' }}>Управление</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {isRecording ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#dc3545', borderRadius: '6px', color: 'white' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
                  <span>Идет запись...</span>
                  <span style={{ fontWeight: 'bold' }}>{formatTime(recordingTime)}</span>
                </div>
                <button onClick={stopRecording} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Остановить запись</button>
              </>
            ) : (
              <button onClick={startRecording} disabled={!navigator.mediaDevices?.getUserMedia} style={{ padding: '12px 24px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>🎤 Начать запись голоса</button>
            )}

            {isTeacherBroadcasting ? (
              <button onClick={stopTeacherScreenShare} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🖥️ Остановить трансляцию</button>
            ) : (
              <button onClick={startTeacherScreenShare} style={{ padding: '10px 20px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🖥️ Начать трансляцию экрана</button>
            )}
          </div>
          <style>{`
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `}</style>
        </div>

        {/* Экран преподавателя */}
        {isTeacherBroadcasting && localStream && (
          <div style={{ marginBottom: '20px', border: '2px solid #007bff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 8px rgba(0,123,255,0.2)' }}>
            <div style={{ padding: '12px', backgroundColor: '#007bff', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🖥️</span>
              <span>Ваш экран (транслируется студентам)</span>
            </div>
            <video 
              autoPlay 
              playsInline 
              muted
              style={{ width: '100%', height: '400px', objectFit: 'contain', backgroundColor: '#000' }}
              ref={el => { if (el) el.srcObject = localStream; }}
            />
          </div>
        )}

        {/* Экран студента */}
        {activeStudentScreen && studentScreenStreams.get(activeStudentScreen.studentSocketId) && (
          <div style={{ marginBottom: '20px', border: '2px solid #28a745', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 8px rgba(40,167,69,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#28a745', color: 'white' }}>
              <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👨‍🎓</span>
                <span>Экран студента: {activeStudentScreen.studentName}</span>
              </div>
              <button 
                onClick={stopWatchingStudentScreen}
                style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                🛑 Остановить просмотр
              </button>
            </div>
            <video 
              autoPlay 
              playsInline 
              muted={false}
              style={{ width: '100%', height: '400px', objectFit: 'contain', backgroundColor: '#000' }}
              ref={el => { 
                if (el) {
                  const stream = studentScreenStreams.get(activeStudentScreen.studentSocketId);
                  el.srcObject = stream || null;
                }
              }}
            />
          </div>
        )}

        {/* Список студентов */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#333' }}>Студенты ({studentsForMonitoring.length})</h3>
            {pendingScreenRequests.length > 0 && (
              <div style={{ padding: '6px 12px', backgroundColor: '#ffc107', color: '#856404', borderRadius: '4px', fontSize: '14px' }}>
                Ожидание ответа: {pendingScreenRequests.length}
              </div>
            )}
          </div>
          {studentsForMonitoring.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <p style={{ color: '#666' }}>Нет подключенных студентов</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
              {studentsForMonitoring.map(renderStudentWithControls)}
            </div>
          )}
        </div>

        {/* Аудиозаписи */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#333', marginBottom: '15px' }}>Аудиозаписи ({recordings.length})</h3>
          {recordings.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <p style={{ color: '#666' }}>Нет аудиозаписей</p>
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
              {recordings.map((recording) => (
                <div key={recording.id} style={{ padding: '15px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>{recording.title || 'Без названия'}</div>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>{recording.description || 'Без описания'}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(recording.createdAt).toLocaleString()} | Длительность: {recording.duration ? formatTime(recording.duration) : 'неизвестно'} | Размер: {(recording.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </div>
                      
                      {transcriptions[recording.id] && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px', borderLeft: '3px solid #007bff' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px', color: '#007bff' }}>Текст:</div>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{transcriptions[recording.id]}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => playRecording(recording.filePath)} style={{ padding: '6px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Воспроизвести</button>
                      <button onClick={() => deleteRecording(recording.id)} style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Удалить</button>
                      <button 
                        onClick={() => transcribeRecording(recording.id)}
                        disabled={transcribing[recording.id]}
                        style={{ 
                          padding: '6px 12px', 
                          backgroundColor: transcribing[recording.id] ? '#6c757d' : '#17a2b8', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          cursor: transcribing[recording.id] ? 'not-allowed' : 'pointer' 
                        }}
                      >
                        {transcribing[recording.id] ? '...' : '📝 Распознать'}
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
            <button onClick={sendMessage} disabled={!newMessage.trim() || !socketRef.current?.connected} style={{ padding: '12px 20px', backgroundColor: newMessage.trim() && socketRef.current?.connected ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: newMessage.trim() && socketRef.current?.connected ? 'pointer' : 'not-allowed', fontWeight: 'bold', minWidth: '100px' }}>Отправить</button>
          </div>
        </div>
      </div>

      {/* Модальное окно сохранения */}
      {showSaveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '500px', maxWidth: '90%', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, color: '#333', marginBottom: '20px' }}>Сохранить аудиозапись</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>Название записи:</label>
              <input type="text" value={recordingTitle} onChange={(e) => setRecordingTitle(e.target.value)} placeholder="Введите название записи" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>Описание (необязательно):</label>
              <textarea value={recordingDescription} onChange={(e) => setRecordingDescription(e.target.value)} placeholder="Введите описание записи" rows="3" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '14px', color: '#666' }}><strong>Информация о записи:</strong></div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>Длительность: {formatTime(recordingDuration)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={cancelRecording} disabled={uploading} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: uploading ? 'not-allowed' : 'pointer' }}>Отмена</button>
              <button onClick={saveRecording} disabled={uploading || !recordingTitle.trim()} style={{ padding: '10px 20px', backgroundColor: uploading || !recordingTitle.trim() ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: uploading || !recordingTitle.trim() ? 'not-allowed' : 'pointer' }}>{uploading ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebinarTeacher;