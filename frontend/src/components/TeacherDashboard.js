import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TeacherDashboard = ({ teacher, onLogout }) => {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesRes, sessionsRes] = await Promise.all([
        axios.get(`/api/teacher/${teacher.id}/courses`),
        axios.get(`/api/teacher/${teacher.id}/sessions`)
      ]);
      setCourses(coursesRes.data);
      setSessions(sessionsRes.data);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post('/api/teacher/courses/create', {
        teacherId: teacher.id,
        ...newCourse
      });
      setCourses([...courses, response.data]);
      setNewCourse({ title: '', description: '' });
      setShowCourseForm(false);
    } catch (err) {
      alert('Ошибка создания курса');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (courseId) => {
    if (window.confirm('Создать новую сессию вебинара?')) {
      try {
        const response = await axios.post('/api/teacher/sessions/create', {
          courseId
        });
        alert(`Сессия создана! ID: ${response.data.id}`);
        loadData();
      } catch (err) {
        alert('Ошибка создания сессии');
      }
    }
  };

  const handleFinishSession = async (sessionId) => {
    if (window.confirm('Завершить сессию?')) {
      try {
        await axios.post(`/api/teacher/sessions/${sessionId}/finish`);
        alert('Сессия завершена');
        loadData();
      } catch (err) {
        alert('Ошибка завершения сессии');
      }
    }
  };

  return (
    <div className="dashboard">
      {/* Шапка */}
      <header className="dashboard-header">
        <div>
          <h1>👨‍🏫 Панель преподавателя</h1>
          <p>{teacher.name} ({teacher.email})</p>
        </div>
        <button onClick={onLogout} className="logout-btn">Выйти</button>
      </header>

      <div className="dashboard-content">
        {/* Курсы */}
        <section className="section">
          <div className="section-header">
            <h2>📚 Мои курсы</h2>
            <button 
              onClick={() => setShowCourseForm(!showCourseForm)}
              className="btn-primary"
            >
              {showCourseForm ? 'Отмена' : '+ Создать курс'}
            </button>
          </div>

          {showCourseForm && (
            <form onSubmit={handleCreateCourse} className="course-form">
              <input
                type="text"
                placeholder="Название курса"
                value={newCourse.title}
                onChange={(e) => setNewCourse({...newCourse, title: e.target.value})}
                required
              />
              <textarea
                placeholder="Описание курса (необязательно)"
                value={newCourse.description}
                onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                rows="3"
              />
              <button type="submit" disabled={loading} className="btn-success">
                {loading ? 'Создание...' : 'Создать курс'}
              </button>
            </form>
          )}

          <div className="courses-grid">
            {courses.map(course => (
              <div key={course.id} className="course-card">
                <h3>{course.title}</h3>
                {course.description && <p>{course.description}</p>}
                <button 
                  onClick={() => handleCreateSession(course.id)}
                  className="btn-action"
                >
                  🚀 Создать сессию
                </button>
              </div>
            ))}
            
            {courses.length === 0 && !showCourseForm && (
              <p className="empty-message">У вас пока нет курсов. Создайте первый!</p>
            )}
          </div>
        </section>

        {/* Активные сессии */}
        <section className="section">
          <h2>📊 Активные сессии</h2>
          
          {sessions.length === 0 ? (
            <p className="empty-message">Нет активных сессий</p>
          ) : (
            <div className="sessions-list">
              {sessions.map(session => (
                <div key={session.id} className="session-card">
                  <div className="session-info">
                    <h3>{session.courseTitle}</h3>
                    <p>ID сессии: {session.id}</p>
                    <p>Начало: {new Date(session.startTime).toLocaleString()}</p>
                    <p>Статус: <span className="status-active">Активна</span></p>
                  </div>
                  <div className="session-actions">
                    <button 
                      onClick={() => handleFinishSession(session.id)}
                      className="btn-danger"
                    >
                      Завершить
                    </button>
                    <button className="btn-secondary">
                      Статистика
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Статистика */}
        <section className="section">
          <h2>📈 Статистика</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{courses.length}</h3>
              <p>Курсов</p>
            </div>
            <div className="stat-card">
              <h3>{sessions.length}</h3>
              <p>Активных сессий</p>
            </div>
            <div className="stat-card">
              <h3>0</h3>
              <p>Студентов всего</p>
            </div>
            <div className="stat-card">
              <h3>0</h3>
              <p>Студентов онлайн</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TeacherDashboard;