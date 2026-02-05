import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
      alert('Курс успешно создан!');
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
    <div style={{ 
      padding: '20px', 
      fontFamily: 'sans-serif',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      {/* Шапка */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#333' }}>Панель преподавателя</h2>
          <p style={{ color: '#666', margin: '5px 0 0 0' }}>
            <strong>{teacher.name}</strong> (ID: {teacher.id})
          </p>
        </div>
        <button 
          onClick={onLogout}
          style={{ 
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Выйти
        </button>
      </div>

      {/* Создание курса */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '25px', 
        backgroundColor: '#e7f3ff', 
        borderRadius: '8px',
        border: '1px solid #b3d9ff'
      }}>
        <h3 style={{ color: '#333', marginBottom: '15px' }}>Создать новый курс</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input
            placeholder="Название курса"
            value={newCourseTitle}
            onChange={(e) => setNewCourseTitle(e.target.value)}
            style={{ 
              flex: 1, 
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
          <button 
            onClick={handleCreateCourse}
            disabled={!newCourseTitle.trim()}
            style={{ 
              padding: '12px 24px',
              backgroundColor: newCourseTitle.trim() ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: newCourseTitle.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap'
            }}
          >
            Создать курс
          </button>
        </div>
      </div>

      {/* Мои курсы */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#333', marginBottom: '20px' }}>Мои курсы ({courses.length})</h3>
        
        {courses.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '2px dashed #dee2e6'
          }}>
            <p style={{ color: '#666', marginBottom: '10px' }}>У вас пока нет курсов</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {courses.map(course => (
              <div key={course.id} style={{ 
                border: '1px solid #dee2e6', 
                padding: '20px', 
                borderRadius: '8px',
                backgroundColor: 'white',
              }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>{course.title}</h4>
                <button 
                  onClick={() => setSelectedCourse(course.id)}
                  style={{ 
                    width: '100%',
                    padding: '10px',
                    backgroundColor: selectedCourse === course.id ? '#28a745' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginBottom: '10px'
                  }}
                >
                  {selectedCourse === course.id ? 'Выбран для создания сессии' : 'Выбрать для сессии'}
                </button>
                <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                  ID: {course.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Создание сессии */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '25px', 
        backgroundColor: '#d4edda',
        borderRadius: '8px',
        border: '1px solid #c3e6cb'
      }}>
        <h3 style={{ color: '#333', marginBottom: '15px' }}>Создать сессию вебинара</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setError('');
            }}
            style={{ 
              padding: '12px', 
              width: '100%', 
              maxWidth: '500px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              backgroundColor: 'white'
            }}
          >
            <option value="">— Выберите курс для вебинара —</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </div>
        
        <button 
          onClick={handleCreateSession}
          disabled={!selectedCourse || loading}
          style={{ 
            padding: '12px 24px',
            backgroundColor: selectedCourse && !loading ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: selectedCourse && !loading ? 'pointer' : 'not-allowed'
          }}
        >
          {loading ? 'Создание...' : 'Создать сессию вебинара'}
        </button>
      </div>

      {/* Активные сессии */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#333', margin: 0 }}>Активные сессии ({sessions.length})</h3>
          <button 
            onClick={loadSessions}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Обновить
          </button>
        </div>
        
        {sessions.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <p style={{ color: '#666', marginBottom: '10px' }}>Нет активных сессий</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gap: '20px'
          }}>
            {sessions.map(session => (
              <div key={session.id} style={{ 
                border: '1px solid #dee2e6', 
                padding: '25px', 
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>
                      {session.courseTitle}
                    </h4>
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '15px',
                      marginBottom: '20px'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>ID сессии:</div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{session.id}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Начало:</div>
                        <div style={{ fontWeight: 'bold' }}>
                          {new Date(session.startTime).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Статус:</div>
                        <div style={{ color: '#28a745', fontWeight: 'bold' }}>Активна</div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column', minWidth: '150px' }}>
                    <button 
                      onClick={() => onEnterWebinar(session.id)}
                      style={{ 
                        padding: '10px 16px', 
                        backgroundColor: '#007bff', 
                        color: 'white', 
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Войти в вебинар
                    </button>
                    <button 
                      onClick={() => handleFinishSession(session.id)}
                      style={{ 
                        padding: '10px 16px', 
                        backgroundColor: '#dc3545', 
                        color: 'white', 
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
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

      {/* Статистика */}
      <div style={{ 
        padding: '25px', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ color: '#333', marginBottom: '20px' }}>Статистика</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px'
        }}>
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#007bff' }}>{courses.length}</div>
            <div style={{ fontSize: '14px', color: '#666' }}>Курсов</div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f7f7f7', borderRadius: '6px' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#28a745' }}>{sessions.length}</div>
            <div style={{ fontSize: '14px', color: '#666' }}>Активных сессий</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;