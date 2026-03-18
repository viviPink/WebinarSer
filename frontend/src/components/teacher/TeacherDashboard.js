// TeacherDashboard.js
import React, { useState, useEffect } from 'react';
import TeacherDashboardView from './TeacherDashboardView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://192.168.0.17:3001';

const TeacherDashboard = ({ teacher, onLogout, onEnterWebinar }) => {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [scheduledSessions, setScheduledSessions] = useState([]);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Загрузка курсов преподавателя
  const loadCourses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher/${teacher.id}/courses`);
      if (!response.ok) throw new Error('Ошибка загрузки курсов');
      const data = await response.json();
      setCourses(data);
    } catch (err) {
      console.error('Ошибка загрузки курсов:', err);
      setError('Ошибка загрузки курсов');
    }
  };

  // Загрузка активных сессий
  const loadSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher/${teacher.id}/sessions/active`);
      if (!response.ok) throw new Error('Ошибка загрузки сессий');
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      console.error('Ошибка загрузки сессий:', err);
      setError('Ошибка загрузки сессий');
    }
  };

  // Загрузка запланированных сессий
  const loadScheduledSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher/${teacher.id}/sessions/scheduled`);
      if (!response.ok) throw new Error('Ошибка загрузки запланированных сессий');
      const data = await response.json();
      setScheduledSessions(data);
    } catch (err) {
      console.error('Ошибка загрузки запланированных сессий:', err);
      setError('Ошибка загрузки запланированных сессий');
    }
  };

  // Создание нового курса
  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim()) {
      setError('Введите название курса');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/teacher/courses/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: teacher.id,
          title: newCourseTitle.trim()
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
    } finally {
      setLoading(false);
    }
  };

  // Создание новой сессии (начать сейчас)
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
        body: JSON.stringify({ 
          courseId: selectedCourse,
          description: sessionDescription.trim() || null
        })
      });
      
      if (!response.ok) throw new Error('Ошибка создания сессии');
      
      const data = await response.json();
      await loadSessions();
      alert(`Сессия вебинара создана! ID: ${data.id}`);
      setSelectedCourse('');
      setSessionDescription('');
    } catch (err) {
      console.error('Ошибка создания сессии:', err);
      setError('Ошибка создания сессии');
    } finally {
      setLoading(false);
    }
  };

  // Планирование сессии
  const handleScheduleSession = async (sessionData) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/teacher/sessions/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sessionData,
          teacherId: teacher.id
        })
      });
      
      if (!response.ok) throw new Error('Ошибка планирования сессии');
      
      const data = await response.json();
      await loadScheduledSessions();
      
      // Форматируем дату для сообщения
      const scheduledDate = new Date(data.scheduledStart);
      const formattedDate = scheduledDate.toLocaleString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      alert(`Сессия запланирована на ${formattedDate}`);
    } catch (err) {
      console.error('Ошибка планирования сессии:', err);
      setError('Ошибка планирования сессии');
    } finally {
      setLoading(false);
    }
  };

  // Завершение сессии
  const handleFinishSession = async (sessionId) => {
    if (!window.confirm('Завершить сессию вебинара?')) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/finish`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Ошибка завершения сессии');
      
      await loadSessions();
      alert('Сессия завершена');
    } catch (err) {
      console.error('Ошибка завершения сессии:', err);
      setError('Ошибка завершения сессии');
    } finally {
      setLoading(false);
    }
  };

  // Удаление запланированной сессии
  const handleDeleteScheduledSession = async (sessionId) => {
    if (!window.confirm('Удалить запланированную сессию?')) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/teacher/sessions/scheduled/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Ошибка удаления сессии');
      
      await loadScheduledSessions();
      alert('Запланированная сессия удалена');
    } catch (err) {
      console.error('Ошибка удаления сессии:', err);
      setError('Ошибка удаления сессии');
    } finally {
      setLoading(false);
    }
  };

  // Редактирование запланированной сессии
  const handleEditScheduledSession = async (sessionData) => {
    // Здесь можно открыть модальное окно для редактирования
    // Пока просто показываем сообщение
    alert(`доделаю потоммммммм `);
    
    // В будущем здесь будет вызов API для обновления 
    console.log('Редактирование сессии:', sessionData);
  };

  // Проверка и автоматический запуск запланированных сессий
  useEffect(() => {
    const checkScheduledSessions = () => {
      const now = new Date();
      
      scheduledSessions.forEach(async (session) => {
        // Пропускаем уже активные сессии
        if (session.isActive) return;
        
        const scheduledTime = new Date(session.scheduledStart);
        const timeDiff = Math.abs(now - scheduledTime) / 1000 / 60; // разница в минутах
        
        // Если время сессии наступило (или прошло не более 5 минут)
        if (timeDiff <= 5 && !session.isActive) {
          try {
            console.log(`Автоматический запуск сессии: ${session.title}`);
            
            const response = await fetch(`${API_BASE_URL}/api/teacher/sessions/start-scheduled`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: session.id })
            });
            
            if (response.ok) {
              await loadSessions();
              await loadScheduledSessions();
              
              // Показываем уведомление только если сессия должна была начаться сейчас
              if (timeDiff <= 1) {
                alert(`Сессия "${session.title}" автоматически запущена!`);
              }
            }
          } catch (err) {
            console.error('Ошибка автоматического запуска сессии:', err);
          }
        }
      });
    };

    // Запускаем проверку каждую минуту
    const interval = setInterval(checkScheduledSessions, 60000);
    
    // Также проверяем сразу при загрузке
    checkScheduledSessions();
    
    return () => clearInterval(interval);
  }, [scheduledSessions]);

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    // Загружаем все данные
    const loadAllData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadCourses(),
          loadSessions(),
          loadScheduledSessions()
        ]);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    
    loadAllData();
    
    // Периодическое обновление активных сессий (каждые 30 секунд)
    const sessionsInterval = setInterval(loadSessions, 30000);
    
    // Периодическое обновление запланированных сессий (каждую минуту)
    const scheduledInterval = setInterval(loadScheduledSessions, 60000);
    
    return () => {
      clearInterval(sessionsInterval);
      clearInterval(scheduledInterval);
    };
  }, [teacher.id]); // Перезагружаем при изменении teacher.id

  return (
    <TeacherDashboardView
      teacher={teacher}
      onLogout={onLogout}
      onEnterWebinar={onEnterWebinar}
      courses={courses}
      sessions={sessions}
      scheduledSessions={scheduledSessions}
      newCourseTitle={newCourseTitle}
      setNewCourseTitle={setNewCourseTitle}
      selectedCourse={selectedCourse}
      setSelectedCourse={setSelectedCourse}
      sessionDescription={sessionDescription}
      setSessionDescription={setSessionDescription}
      error={error}
      setError={setError}
      loading={loading}
      handleCreateCourse={handleCreateCourse}
      handleCreateSession={handleCreateSession}
      handleScheduleSession={handleScheduleSession}
      handleFinishSession={handleFinishSession}
      handleDeleteScheduledSession={handleDeleteScheduledSession}
      handleEditScheduledSession={handleEditScheduledSession}
      loadSessions={loadSessions}
      loadScheduledSessions={loadScheduledSessions}
    />
  );
};

export default TeacherDashboard;