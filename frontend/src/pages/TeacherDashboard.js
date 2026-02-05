import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const TeacherDashboard = ({ teacher, onEnterWebinar, onLogout }) => {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCourses = async () => {
    try {
      const data = await api.getTeacherCourses(teacher.id);
      setCourses(data);
    } catch (err) {
      console.error('Ошибка загрузки курсов:', err);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await api.getTeacherActiveSessions(teacher.id);
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
    
    setLoading(true);
    try {
      const course = await api.createCourse(teacher.id, newCourseTitle);
      setCourses([...courses, course]);
      setNewCourseTitle('');
      alert('Курс успешно создан!');
    } catch (err) {
      console.error('Ошибка создания курса:', err);
      setError('Ошибка создания курса');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedCourse) {
      setError('Выберите курс для создания сессии');
      return;
    }
    
    setLoading(true);
    try {
      const session = await api.createSession(selectedCourse);
      await loadSessions();
      alert(`Сессия вебинара создана! ID: ${session.id}`);
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
      await api.finishSession(sessionId);
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
  }, [teacher.id]);

  return (
    <div className="container">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Панель преподавателя</h2>
          <p className="dashboard-user-info">
            <strong>{teacher.name}</strong> (ID: {teacher.id})
          </p>
        </div>
        <button className="button button-danger" onClick={onLogout}>
          Выйти
        </button>
      </div>

      {/* Создание курса */}
      <div className="card mb-30" style={{backgroundColor: '#e7f3ff', borderColor: '#b3d9ff'}}>
        <h3 style={{color: '#007bff'}} className="section-title">Создать новый курс</h3>
        <div className="flex gap-10 mb-15">
          <input
            className="input"
            placeholder="Название курса"
            value={newCourseTitle}
            onChange={(e) => setNewCourseTitle(e.target.value)}
          />
          <button 
            className="button button-primary"
            onClick={handleCreateCourse}
            disabled={!newCourseTitle.trim() || loading}
          >
            {loading ? 'Создание...' : 'Создать курс'}
          </button>
        </div>
      </div>

      {/* Мои курсы */}
      <div className="section">
        <h3 className="section-title">Мои курсы ({courses.length})</h3>
        {courses.length === 0 ? (
          <div className="card text-center" style={{borderStyle: 'dashed'}}>
            <p style={{color: '#666'}} className="mb-10">У вас пока нет курсов</p>
          </div>
        ) : (
          <div className="courses-grid">
            {courses.map(course => (
              <div key={course.id} className="course-card">
                <h4 className="course-name">{course.title}</h4>
                <button 
                  className={`button w-100 mb-10 ${selectedCourse === course.id ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => setSelectedCourse(course.id)}
                >
                  {selectedCourse === course.id ? '✓ Выбран для создания сессии' : 'Выбрать для сессии'}
                </button>
                <div className="text-center" style={{fontSize: '12px', color: '#666'}}>
                  ID: {course.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Создание сессии */}
      <div className="card mb-30" style={{backgroundColor: '#d4edda', borderColor: '#c3e6cb'}}>
        <h3 style={{color: '#155724'}} className="section-title">Создать сессию вебинара</h3>
        <div className="mb-15">
          <select
            className="input"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            style={{maxWidth: '500px'}}
          >
            <option value="">— Выберите курс для вебинара —</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </div>
        <button 
          className="button button-success"
          onClick={handleCreateSession}
          disabled={!selectedCourse || loading}
        >
          {loading ? 'Создание...' : 'Создать сессию вебинара'}
        </button>
      </div>

      {/* Активные сессии */}
      <div className="section">
        <div className="flex justify-between items-center mb-20">
          <h3 className="section-title" style={{margin: 0}}>Активные сессии ({sessions.length})</h3>
          <button className="button button-secondary" onClick={loadSessions}>
            Обновить
          </button>
        </div>
        
        {sessions.length === 0 ? (
          <div className="card text-center">
            <p style={{color: '#666'}} className="mb-10">Нет активных сессий</p>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map(session => (
              <div key={session.id} className="session-card">
                <div className="session-header">
                  <div style={{flex: 1}}>
                    <h4 className="session-title">{session.courseTitle}</h4>
                    <div className="session-info-grid">
                      <div>
                        <div className="session-info-item">ID сессии:</div>
                        <div className="session-info-value">{session.id}</div>
                      </div>
                      <div>
                        <div className="session-info-item">Начало:</div>
                        <div className="session-info-value">
                          {new Date(session.startTime).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="session-info-item">Статус:</div>
                        <div style={{color: '#28a745', fontWeight: 'bold'}}>Активна</div>
                      </div>
                    </div>
                  </div>
                  <div className="session-actions">
                    <button 
                      className="button button-success"
                      onClick={() => onEnterWebinar(session)}
                    >
                      Войти в вебинар
                    </button>
                    <button 
                      className="button button-danger"
                      onClick={() => handleFinishSession(session.id)}
                    >
                      Завершить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;