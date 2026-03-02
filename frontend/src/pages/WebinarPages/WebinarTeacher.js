import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import WebinarTeacherView from './WebinarTeacherView';
import AudioRecorder from '../../components/webinar/AudioRecorder';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:3001';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://localhost:3001';

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
  const [liveTranscription, setLiveTranscription] = useState('');
  
  const messagesEndRef = useRef(null);
  const isMountedRef = useRef(true);
  const teacherPeerConnectionsRef = useRef(new Map());
  const studentVideoRef = useRef(null);
  const teacherVideoRef = useRef(null);

  const startTeacherScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      setLocalStream(stream);
      setIsTeacherBroadcasting(true);

      const studentSocketIds = studentsForMonitoring.map(s => s.socketId);
      const newPeerConnections = new Map();

      for (const studentSocketId of studentSocketIds) {
        const pc = new RTCPeerConnection();

        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer({
          offerToReceiveVideo: false,
          offerToReceiveAudio: false
        });
        await pc.setLocalDescription(offer);

        if (socketRef.current) {
          socketRef.current.emit('teacher_send_offer_to_students', {
            sessionId,
            studentSocketIds: [studentSocketId],
            sdp: offer
          });
        }

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current?.connected) {
            socketRef.current.emit('webrtc_ice_candidate', { 
              to: studentSocketId, 
              candidate: event.candidate 
            });
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('ICE состояние с ' + studentSocketId + ':', pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed') {
            console.error('Соединение с ' + studentSocketId + ' не удалось');
          }
        };

        newPeerConnections.set(studentSocketId, pc);
      }

      teacherPeerConnectionsRef.current = newPeerConnections;

      if (socketRef.current) {
        socketRef.current.emit('teacher_start_screen_share', { 
          sessionId,
          streamType: 'teacher_to_all' 
        });
      }

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

    teacherPeerConnectionsRef.current.forEach((pc, studentSocketId) => {
      pc.close();
      console.log('Соединение с ' + studentSocketId + ' закрыто');
    });

    teacherPeerConnectionsRef.current.clear();
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
    const pc = teacherPeerConnectionsRef.current.get(from);
    if (pc && pc.signalingState !== 'closed') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error('Ошибка установки remote description:', err);
      }
    }
  };

  const handleWebrtcIceCandidate = ({ from, candidate }) => {
    const pc = teacherPeerConnectionsRef.current.get(from);
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
      console.log('Получен оффер от студента ' + from);

      const pc = new RTCPeerConnection();

      pc.ontrack = (event) => {
        console.log('Получен трек от студента ' + from, event.streams);
        if (event.streams && event.streams[0]) {
          console.log('Поток студента ' + from + ' готов');
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
          console.log('ICE кандидат для ' + from + ':', event.candidate);
          socketRef.current.emit('webrtc_ice_candidate', { to: from, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          console.log('СОЕДИНЕНИЕ С ' + from + ' УСТАНОВЛЕНО!');
        } else if (pc.connectionState === 'failed') {
          console.error('СОЕДИНЕНИЕ С ' + from + ' НЕ УДАЛОСЬ!');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE состояние с ' + from + ':', pc.iceConnectionState);
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log('Remote description установлен для ' + from);
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('Answer создан для ' + from);
         
        if (socketRef.current) {
          socketRef.current.emit('webrtc_answer', { to: from, sdp: answer });
        }

        setPeerConnections(prev => {
          const newMap = new Map(prev);
          newMap.set(from, pc);
          return newMap;
        });
        
        console.log('Соединение с ' + from + ' готово');
      } catch (err) {
        console.error('Ошибка обработки оффера студента ' + from + ':', err);
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

  const handleTranscriptionUpdate = (text) => {
    setLiveTranscription(text);
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
        
        alert('Транскрипция готова! Слов: ' + (result.wordCount || 'неизвестно'));
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

  const handleParticipantsList = (list) => {
    setParticipants(list);
    setStudentsForMonitoring(list.filter(p => p.userType === 'student'));
  };

  const handleUserJoined = (user) => {
    setParticipants(prev => {
      const exists = prev.some(p => 
        p.socketId === user.socketId || 
        (p.userId === user.userId && p.userType === user.userType)
      );
      
      if (exists) {
        return prev.map(p => 
          (p.userId === user.userId && p.userType === user.userType) ? user : p
        );
      } else {
        return [...prev, user];
      }
    });
    
    if (user.userType === 'student') {
      setStudentsForMonitoring(prev => {
        const exists = prev.some(s => s.userId === user.userId);
        if (exists) {
          return prev.map(s => s.userId === user.userId ? user : s);
        } else {
          return [...prev, user];
        }
      });
    }
  };

  const handleUserLeft = (user) => {
    setParticipants(prev => prev.filter(p => p.socketId !== user.socketId));
    if (user.userType === 'student') {
      setStudentsForMonitoring(prev => prev.filter(s => s.socketId !== user.socketId));
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

      setTimeout(() => {
        if (socketRef.current?.connected) {
          socketRef.current.emit('get_participants_list', { sessionId });
        }
      }, 500);
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

  useEffect(() => {
    if (teacherVideoRef.current && localStream) {
      console.log('Установка потока преподавателя в видео элемент');
      teacherVideoRef.current.srcObject = localStream;
      teacherVideoRef.current.play().catch(err => {
        console.error('Ошибка воспроизведения экрана преподавателя:', err);
      });
    }
  }, [localStream]);

  useEffect(() => {
    if (studentVideoRef.current && activeStudentScreen) {
      const stream = studentScreenStreams.get(activeStudentScreen.studentSocketId);
      
      if (stream) {
        console.log('Установка потока студента в видео элемент:', activeStudentScreen.studentSocketId);
        studentVideoRef.current.srcObject = stream;
        
        const handleLoadedMetadata = () => {
          console.log('Видео студента готово к воспроизведению');
          studentVideoRef.current.play().catch(err => {
            console.error('Ошибка воспроизведения:', err);
          });
        };
        
        studentVideoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        
        return () => {
          if (studentVideoRef.current) {
            studentVideoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          }
        };
      } else {
        console.log('Поток НЕ найден для студента:', activeStudentScreen.studentSocketId);
        studentVideoRef.current.srcObject = null;
      }
    }
  }, [activeStudentScreen, studentScreenStreams]);

  return (
    <WebinarTeacherView
      sessionId={sessionId}
      teacher={teacher}
      onExit={onExit}
      messages={messages}
      newMessage={newMessage}
      setNewMessage={setNewMessage}
      participants={participants}
      studentsForMonitoring={studentsForMonitoring}
      connectionStatus={connectionStatus}
      localStream={localStream}
      studentScreenStreams={studentScreenStreams}
      isTeacherBroadcasting={isTeacherBroadcasting}
      activeStudentScreen={activeStudentScreen}
      pendingScreenRequests={pendingScreenRequests}
      recordings={recordings}
      transcriptions={transcriptions}
      transcribing={transcribing}
      editingTranscription={editingTranscription}
      liveTranscription={liveTranscription}
      messagesEndRef={messagesEndRef}
      studentVideoRef={studentVideoRef}
      teacherVideoRef={teacherVideoRef}
      socketRef={socketRef}
      startTeacherScreenShare={startTeacherScreenShare}
      stopTeacherScreenShare={stopTeacherScreenShare}
      requestStudentScreen={requestStudentScreen}
      stopWatchingStudentScreen={stopWatchingStudentScreen}
      fetchRecordings={fetchRecordings}
      handleOpenTranscriptionEditor={handleOpenTranscriptionEditor}
      handleCloseTranscriptionEditor={handleCloseTranscriptionEditor}
      handleSaveTranscription={handleSaveTranscription}
      handleTranscriptionUpdate={handleTranscriptionUpdate}
      formatTime={formatTime}
      playRecording={playRecording}
      deleteRecording={deleteRecording}
      transcribeRecording={transcribeRecording}
      sendMessage={sendMessage}
      finishWebinar={finishWebinar}
    />
  );
};

export default WebinarTeacher;