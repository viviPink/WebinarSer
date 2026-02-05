import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Header from '../../components/common/Header';
import Participants from '../../components/common/Participants';
import Chat from '../../components/common/Chat';
import ScreenShare from '../../components/webinar/ScreenShare';
import AudioRecorder from '../../components/webinar/AudioRecorder';
import TranscriptionModal from '../../components/webinar/TranscriptionModal';

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

  const [localStream, setLocalStream] = useState(null);
  const [studentScreenStreams, setStudentScreenStreams] = useState(new Map());
  const [peerConnections, setPeerConnections] = useState(new Map());
  const [isTeacherBroadcasting, setIsTeacherBroadcasting] = useState(false);
  const [activeStudentScreen, setActiveStudentScreen] = useState(null);
  const [pendingScreenRequests, setPendingScreenRequests] = useState([]);

  const [recordings, setRecordings] = useState([]);
  const [transcriptions, setTranscriptions] = useState({});
  const [transcribing, setTranscribing] = useState({});
  const [editingTranscription, setEditingTranscription] = useState(null);

  const messagesEndRef = useRef(null);
  const isMountedRef = useRef(true);
  const teacherPcRef = useRef(null);

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
        console.error('Ошибка установки:', err);
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

  const fetchRecordings = () => {
    fetch(`${API_BASE_URL}/api/audio/session/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (isMountedRef.current) {
          setRecordings(Array.isArray(data) ? data : []);
          
          const newTranscriptions = {};
          data.forEach(recording => {
            if (recording.transcription) {
              newTranscriptions[recording.id] = recording.transcription;
            }
          });
          setTranscriptions(newTranscriptions);
        }
      })
      .catch(() => setRecordings([]));
  };

  const handleOpenTranscriptionEditor = (recordingId) => {
    setEditingTranscription(recordingId);
  };

  const handleCloseTranscriptionEditor = () => {
    setEditingTranscription(null);
  };

  const handleSaveTranscription = (recordingId, newTranscription) => {
    setTranscriptions(prev => ({
      ...prev,
      [recordingId]: newTranscription
    }));
    
    fetchRecordings();
    handleCloseTranscriptionEditor();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
      
      setTranscriptions(prev => {
        const newTranscriptions = { ...prev };
        delete newTranscriptions[recordingId];
        return newTranscriptions;
      });
      
      alert('Запись удалена');
    } catch (err) {
      console.error('Ошибка удаления записи:', err);
      alert('Ошибка удаления записи');
    }
  };

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
        
        const updatedRecordings = recordings.map(rec => 
          rec.id === recordingId 
            ? { ...rec, transcription: result.text }
            : rec
        );
        setRecordings(updatedRecordings);
        
        alert(`Транскрипция готова! Слов: ${result.wordCount || 'неизвестно'}`);
      } else {
        alert('Ошибка: ' + (result.error || 'неизвестно'));
      }
    } catch (err) {
      console.error('Ошибка транскрибирования:', err);
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
    if (window.confirm('Завершить вебинар?')) {
      fetch(`${API_BASE_URL}/api/sessions/${sessionId}/finish`, { method: 'POST' })
        .then(() => {
          onExit();
        })
        .catch(err => console.error('Ошибка завершения сессии:', err));
    }
  };

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

    fetchRecordings();

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
      if (data.recording.transcription) {
        setTranscriptions(prev => ({
          ...prev,
          [data.recording.id]: data.recording.transcription
        }));
      }
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
          {activeStudentScreen?.studentSocketId === student.socketId ? 'Смотрит экран' : 'Запросить экран'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8f9fa' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
        {/* Шапка */}
        <Header 
          title="Вебинар - Преподаватель"
          subtitle={`Сессия ID: ${sessionId}`}
          additionalInfo={`Студентов: ${studentsForMonitoring.length}`}
          onBack={() => {
            if (window.confirm('Вы уверены, что хотите выйти? Вебинар продолжит работать.')) {
              onExit();
            }
          }}
          backButtonText="← Выйти"
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={finishWebinar} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Завершить вебинар
            </button>
          </div>
        </Header>

        {/* Запись аудио */}
        <AudioRecorder 
          sessionId={sessionId}
          teacherId={teacher.id}
          teacherName={teacher.name}
          socketRef={socketRef}
          onRecordingSaved={fetchRecordings}
        />

        {/* Трансляция экрана преподавателя */}
        {isTeacherBroadcasting && localStream && (
          <ScreenShare 
            stream={localStream}
            title="Ваш экран (транслируется студентам)"
            backgroundColor="#007bff"
            color="white"
            height="400px"
            muted={true}
          />
        )}

        {/* Экран студента */}
        {activeStudentScreen && studentScreenStreams.get(activeStudentScreen.studentSocketId) && (
          <div style={{ marginBottom: '20px', border: '2px solid #28a745', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 8px rgba(40,167,69,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#28a745', color: 'white' }}>
              <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📺 Экран студента: {activeStudentScreen.studentName}</span>
              </div>
              <button 
                onClick={stopWatchingStudentScreen}
                style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Остановить просмотр
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

        {/* Управление трансляцией экрана */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {isTeacherBroadcasting ? (
              <button onClick={stopTeacherScreenShare} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Остановить трансляцию экрана
              </button>
            ) : (
              <button onClick={startTeacherScreenShare} style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Начать трансляцию экрана
              </button>
            )}
          </div>
        </div>

        {/* Студенты */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#333' }}>Студенты ({studentsForMonitoring.length})</h3>
            {pendingScreenRequests.length > 0 && (
              <div style={{ padding: '6px 12px', backgroundColor: '#ffc107', color: '#000', borderRadius: '4px', fontSize: '14px' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>
                        {recording.title || 'Без названия'}
                        {recording.transcription && (
                          <span style={{ 
                            marginLeft: '10px',
                            padding: '2px 8px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 'normal'
                          }}>
                            Есть конспект
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                        {recording.description || 'Без описания'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(recording.createdAt).toLocaleString()} | 
                        Длительность: {recording.duration ? formatTime(recording.duration) : 'неизвестно'} | 
                        Размер: {(recording.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </div>
                      
                      {(recording.transcription || transcriptions[recording.id]) && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f4f5f7', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px', color: '#495057' }}>Конспект:</div>
                          <div style={{ 
                            whiteSpace: 'pre-wrap', 
                            fontSize: '13px',
                            lineHeight: '1.4',
                            maxHeight: '100px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {recording.transcription || transcriptions[recording.id]}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => playRecording(recording.filePath)}
                        style={{ 
                          padding: '6px 12px', 
                          backgroundColor: '#050607', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        Воспроизвести
                      </button>
                      
                      <button 
                        onClick={() => deleteRecording(recording.id)}
                        style={{ 
                          padding: '6px 12px', 
                          backgroundColor: '#070505', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        Удалить
                      </button>
                      
                      {!recording.transcription ? (
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          {transcribing[recording.id] ? (
                            <>
                              <span style={{
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                border: '2px solid white',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                              }}></span>
                              Обработка
                            </>
                          ) : (
                            'Распознать речь'
                          )}
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleOpenTranscriptionEditor(recording.id)}
                          style={{ 
                            padding: '6px 12px', 
                            backgroundColor: '#6c757d', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            fontSize: '12px', 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          Редактировать конспект
                        </button>
                      )}
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
        <Participants participants={participants} />
        
        {/* Чат */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
          <Chat 
            messages={messages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            sendMessage={sendMessage}
            disabled={!newMessage.trim() || !socketRef.current?.connected}
            placeholder="Введите сообщение..."
          />
        </div>
      </div>

      {/* Модальное окно редактирования транскрипции */}
      {editingTranscription && (
        <TranscriptionModal
          recordingId={editingTranscription}
          onClose={handleCloseTranscriptionEditor}
          onSave={handleSaveTranscription}
        />
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default WebinarTeacher;