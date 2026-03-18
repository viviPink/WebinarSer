import React, { useState, useEffect } from 'react';
import StudentDashboardView from './StudentDashboardView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://192.168.0.17:3001';

const StudentDashboard = ({ student, onLogout, onEnterWebinar }) => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);

  const loadSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions/active`);
      if (!response.ok) {
        throw new Error('Ошибка загрузки сессий');
      }
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      console.error('Ошибка загрузки сессий:', err);
      setError('Не удалось загрузить сессии');
    }
  };

  const loadRecordings = async () => {
    if (!student?.id) return;
    
    setLoadingRecordings(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/audio/student/${student.id}`);
      if (!response.ok) {
        throw new Error('Ошибка загрузки записей');
      }
      const data = await response.json();
      setRecordings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Ошибка загрузки записей:', err);
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleJoinSession = async () => {
    if (!selectedSession) {
      setError('Выберите сессию');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: student.full_name,
          groupName: student.group,
          sessionId: selectedSession
        })
      });
      
      if (!response.ok) {
        throw new Error('Ошибка сервера');
      }
      
      const data = await response.json();
      if (data.success) {
        const session = sessions.find(s => s.id === parseInt(selectedSession));
        if (session) {
          setCurrentSession(session);
          setIsJoined(true);
          onEnterWebinar(selectedSession);
        }
      }
    } catch (err) {
      console.error('Ошибка присоединения:', err);
      setError('Не удалось присоединиться к сессии');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const playRecording = (filePath) => {
    const audioUrl = `${API_BASE_URL}${filePath}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(err => console.error('Ошибка воспроизведения:', err));
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (student?.id) {
      loadRecordings();
    }
  }, [student]);

  return (
    <StudentDashboardView
      student={student}
      onLogout={onLogout}
      onEnterWebinar={onEnterWebinar}
      sessions={sessions}
      selectedSession={selectedSession}
      currentSession={currentSession}
      error={error}
      loading={loading}
      isJoined={isJoined}
      recordings={recordings}
      loadingRecordings={loadingRecordings}
      formatTime={formatTime}
      playRecording={playRecording}
      setSelectedSession={setSelectedSession}
      setError={setError}
      handleJoinSession={handleJoinSession}
      loadSessions={loadSessions}
    />
  );
};

export default StudentDashboard;