import React, { useState, useEffect } from 'react';
import TeacherDashboardView from './TeacherDashboardView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:3001';

const TeacherDashboard = ({ teacher, onLogout, onEnterWebinar }) => {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCourses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher/${teacher.id}/courses`);
      if (!response.ok) throw new Error('Ошибка загрузки курсов');
      const data = await response.json();
      setCourses(data);
    } catch (err) {
      console.error('Ошибка загрузки курсов:', err);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher/${teacher.id}/sessions/active`);
      if (!response.ok) throw new Error('Ошибка загрузки сессий');
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      console.error('Ошибка загрузки сессий:', err);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim()) {
      setError('Введите название курса');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher/courses/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: teacher.id,
          title: newCourseTitle
        })
      });
      
      if (!response.ok) throw new Error('Ошибка создания курса');
      
      const data = await response.json();
      setCourses([...courses, data]);
      setNewCourseTitle('');
      alert('Курс успешно создан');
    } catch (err) {
      console.error('Ошибка создания курса:', err);
      setError('Ошибка создания курса');
    }
  };

  const handleCreateSession = async () => {
    if (!selectedCourse) {
      setError('Выберите курс для создания сессии');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/teacher/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedCourse })
      });
      
      if (!response.ok) throw new Error('Ошибка создания сессии');
      
      const data = await response.json();
      await loadSessions();
      alert(`Сессия вебинара создана! ID: ${data.id}`);
      setSelectedCourse('');
    } catch (err) {
      console.error('Ошибка создания сессии:', err);
      setError('Ошибка создания сессии');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishSession = async (sessionId) => {
    if (!window.confirm('Завершить сессию вебинара?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/finish`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Ошибка завершения сессии');
      
      await loadSessions();
      alert('Сессия завершена');
    } catch (err) {
      console.error('Ошибка завершения сессии:', err);
      setError('Ошибка завершения сессии');
    }
  };

  useEffect(() => {
    loadCourses();
    loadSessions();
    
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TeacherDashboardView
      teacher={teacher}
      onLogout={onLogout}
      onEnterWebinar={onEnterWebinar}
      courses={courses}
      sessions={sessions}
      newCourseTitle={newCourseTitle}
      setNewCourseTitle={setNewCourseTitle}
      selectedCourse={selectedCourse}
      setSelectedCourse={setSelectedCourse}
      error={error}
      setError={setError}  // <-- добавить сюда
      loading={loading}
      handleCreateCourse={handleCreateCourse}
      handleCreateSession={handleCreateSession}
      handleFinishSession={handleFinishSession}
      loadSessions={loadSessions}
    />
  );
};

export default TeacherDashboard;