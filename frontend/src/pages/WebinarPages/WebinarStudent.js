import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import WebinarStudentView from './WebinarStudentView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://192.168.0.17:3001';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://192.168.0.17:3001';

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
  const [teacherScreenActive, setTeacherScreenActive] = useState(false);
  const [teacherScreenStream, setTeacherScreenStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenSharingTo, setScreenSharingTo] = useState(null);
  const [incomingScreenRequest, setIncomingScreenRequest] = useState(null);
  
  const messagesEndRef = useRef(null);
  const isMountedRef = useRef(true);
  const teacherPcRef = useRef(null);
  const teacherVideoRef = useRef(null);

  const startStudentScreenShare = async (teacherSocketId) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      setLocalStream(stream);
      setIsSharingScreen(true);
      setScreenSharingTo(teacherSocketId);

      // Удалена конфигурация iceServers - STUN больше не используется
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
        socketRef.current.emit('student_webrtc_offer', {
          to: teacherSocketId,
          sdp: offer,
          streamType: 'student_to_teacher',
          sessionId
        });
      }

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

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          console.log('СОЕДИНЕНИЕ С ПРЕПОДАВАТЕЛЕМ УСТАНОВЛЕНО!');
        } else if (pc.connectionState === 'failed') {
          console.error('СОЕДИНЕНИЕ С ПРЕПОДАВАТЕЛЕМ НЕ УДАЛОСЬ!');
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

    if (socketRef.current && screenSharingTo) {
      socketRef.current.emit('stop_screen_share', {
        sessionId,
        streamType: 'student_to_teacher',
        targetSocketId: screenSharingTo
      });
    }
  };

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

  const handleTeacherWebrtcOffer = async ({ from, sdp, streamType }) => {
    if (streamType === 'teacher_to_all') {
      console.log('Получен оффер от преподавателя');

      if (teacherPcRef.current) {
        teacherPcRef.current.close();
      }

      // Удалена конфигурация iceServers - STUN больше не используется
      const pc = new RTCPeerConnection();

      pc.ontrack = (event) => {
        console.log('Получен трек от преподавателя', event);
        if (event.streams && event.streams[0]) {
          console.log('Поток преподавателя готов');
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

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          console.log('СОЕДИНЕНИЕ С ПРЕПОДАВАТЕЛЕМ УСТАНОВЛЕНО!');
        } else if (pc.connectionState === 'failed') {
          console.error('СОЕДИНЕНИЕ С ПРЕПОДАВАТЕЛЕМ НЕ УДАЛОСЬ!');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE состояние (студент):', pc.iceConnectionState);
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log('Remote description установлен');
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('Answer создан');
        
        if (socketRef.current) {
          socketRef.current.emit('webrtc_answer', { to: from, sdp: answer });
          console.log('Answer отправлен преподавателю');
        }

        teacherPcRef.current = pc;
      } catch (err) {
        console.error('Ошибка обработки оффера преподавателя:', err);
        pc.close();
      }
    }
  };

  const handleWebrtcAnswer = async ({ from, sdp }) => {
    if (peerConnection && from === screenSharingTo) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error('Ошибка установки remote description:', err);
      }
    }
  };

  const handleWebrtcIceCandidate = ({ from, candidate }) => {
    if (teacherPcRef.current && from === teacherSocketId) {
      if (teacherPcRef.current && candidate) {
        try {
          teacherPcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Ошибка добавления ICE кандидата:', err);
        }
      }
    }

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

  const handleTeacherRequestedStudentScreen = ({ teacherSocketId, teacherName, requestId }) => {
    setIncomingScreenRequest({
      teacherSocketId,
      teacherName,
      requestId
    });
  };

  const handleTeacherStoppedWatching = () => {
    stopStudentScreenShare();
  };

  const handleParticipantsList = (list) => {
    setParticipants(list);
    
    const teacher = list.find(p => p.userType === 'teacher');
    if (teacher) {
      setTeacherPresent(true);
      setTeacherName(teacher.userName);
      setTeacherSocketId(teacher.socketId);
    } else {
      setTeacherPresent(false);
      setTeacherName('');
      setTeacherSocketId(null);
    }
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

    if (user.userType === 'teacher') {
      setTeacherPresent(true);
      setTeacherName(user.userName);
      setTeacherSocketId(user.socketId);
    }
  };

  const handleUserLeft = (user) => {
    setParticipants(prev => prev.filter(p => p.socketId !== user.socketId));
    
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

      setTimeout(() => {
        if (socketRef.current?.connected) {
          socketRef.current.emit('get_participants_list', { sessionId });
        }
      }, 500);
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
        socketRef.current.emit('leave_webinar', { sessionId });
        socketRef.current.disconnect();
      }
      if (peerConnection) peerConnection.close();
      if (teacherPcRef.current) teacherPcRef.current.close();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (teacherScreenStream) teacherScreenStream.getTracks().forEach(t => t.stop());
      socketRef.current = null;
    };
  }, [sessionId, student]);

  useEffect(() => {
    if (!socketRef.current) return;

    const handleNewMessage = (message) => setMessages(prev => [...prev, message]);

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
    if (teacherVideoRef.current && teacherScreenActive) {
      teacherVideoRef.current.srcObject = teacherScreenStream || null;
      
      if (teacherScreenStream) {
        teacherVideoRef.current.play().catch(err => {
          console.error('Ошибка воспроизведения:', err);
        });
      }
    }
  }, [teacherScreenActive, teacherScreenStream]);

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
    <WebinarStudentView
      sessionId={sessionId}
      student={student}
      onExit={onExit}
      messages={messages}
      newMessage={newMessage}
      setNewMessage={setNewMessage}
      participants={participants}
      connectionStatus={connectionStatus}
      teacherPresent={teacherPresent}
      teacherName={teacherName}
      teacherScreenActive={teacherScreenActive}
      teacherScreenStream={teacherScreenStream}
      localStream={localStream}
      isSharingScreen={isSharingScreen}
      incomingScreenRequest={incomingScreenRequest}
      setIncomingScreenRequest={setIncomingScreenRequest}
      messagesEndRef={messagesEndRef}
      teacherVideoRef={teacherVideoRef}
      sendMessage={sendMessage}
      trackActivity={trackActivity}
      startStudentScreenShare={startStudentScreenShare}
      stopStudentScreenShare={stopStudentScreenShare}
      socketRef={socketRef}
    />
  );
};

export default WebinarStudent;