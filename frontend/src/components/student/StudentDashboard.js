import React, { useState, useEffect } from 'react';
import StudentDashboardView from './StudentDashboardView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:3001';

const StudentDashboard = ({ student, onLogout, onEnterWebinar }) => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

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
        }
      }
    } catch (err) {
      console.error('Ошибка присоединения:', err);
      setError('Не удалось присоединиться к сессии');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  const props = {
    student,
    onLogout,
    onEnterWebinar,
    sessions,
    selectedSession,
    currentSession,
    error,
    loading,
    isJoined,
    setSelectedSession,
    setError,        
    handleJoinSession,
    loadSessions
  };

  return <StudentDashboardView {...props} />;
};

export default StudentDashboard;