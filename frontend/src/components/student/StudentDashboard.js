import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

  // Если студент присоединился к сессии
  if (isJoined && currentSession) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'sans-serif', 
        maxWidth: '600px', 
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#333' }}>Панель студента</h2>
            <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
              <strong>{student.full_name}</strong> (Группа: {student.group})
            </p>
          </div>
          <button 
            onClick={onLogout}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Выйти
          </button>
        </div>

        <div style={{ 
          padding: '30px', 
          backgroundColor: '#d4edda',
          borderRadius: '8px',
          textAlign: 'center',
          marginBottom: '20px',
          border: '1px solid #c3e6cb'
        }}>
          <h3 style={{ color: '#155724', marginBottom: '10px' }}>
            Вы успешно присоединились к сессии
          </h3>
          <p style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>
            <strong>{currentSession.courseTitle}</strong>
          </p>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Преподаватель: {currentSession.teacherName}
          </p>
          <button 
            onClick={() => onEnterWebinar(currentSession.id)}
            style={{ 
              padding: '12px 24px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            Перейти в вебинар
          </button>
        </div>

        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h4 style={{ color: '#333', marginBottom: '15px' }}>Информация о сессии:</h4>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ fontWeight: 'bold', color: '#666' }}>ID сессии:</span>
              <span>{currentSession.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ fontWeight: 'bold', color: '#666' }}>Дисциплина:</span>
              <span>{currentSession.courseTitle}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ fontWeight: 'bold', color: '#666' }}>Преподаватель:</span>
              <span>{currentSession.teacherName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ fontWeight: 'bold', color: '#666' }}>Начало:</span>
              <span>{new Date(currentSession.startTime).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontWeight: 'bold', color: '#666' }}>Статус:</span>
              <span style={{ color: '#28a745', fontWeight: 'bold' }}>Активна</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Основная панель студента
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'sans-serif', 
      maxWidth: '600px', 
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa'
    }}>
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
          <h2 style={{ margin: 0, color: '#333' }}>Панель студента</h2>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
            <strong>{student.full_name}</strong> (Группа: {student.group})
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
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Выйти
        </button>
      </div>

      <div style={{ 
        padding: '25px', 
        backgroundColor: '#e7f3ff',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid #b3d9ff'
      }}>
        <h3 style={{ color: '#333', marginBottom: '15px' }}>Присоединиться к вебинару</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <select
            value={selectedSession}
            onChange={(e) => {
              setSelectedSession(e.target.value);
              setError('');
            }}
            style={{ 
              width: '100%', 
              padding: '12px', 
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              backgroundColor: 'white'
            }}
          >
            <option value="">— Выберите вебинар —</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.courseTitle} - {session.teacherName}
              </option>
            ))}
          </select>
        </div>

        <button 
          onClick={handleJoinSession}
          disabled={!selectedSession || loading}
          style={{ 
            width: '100%', 
            padding: '15px', 
            backgroundColor: (!selectedSession || loading) ? '#6c757d' : '#007bff',
            color: 'white', 
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: (!selectedSession || loading) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Присоединение...' : 'Присоединиться к вебинару'}
        </button>
        
        {error && (
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
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

      {/* Список доступных сессий */}
      <div style={{ 
        padding: '25px', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: '#333', margin: 0 }}>Доступные вебинары</h3>
          <button 
            onClick={loadSessions}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Обновить
          </button>
        </div>
        
        {sessions.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            border: '2px dashed #dee2e6'
          }}>
            <p style={{ color: '#666', marginBottom: '10px' }}>Нет доступных вебинаров</p>
          </div>
        ) : (
          <div style={{ 
            maxHeight: '400px',
            overflowY: 'auto',
            border: '1px solid #dee2e6',
            borderRadius: '6px'
          }}>
            {sessions.map((session) => (
              <div 
                key={session.id} 
                style={{ 
                  padding: '20px', 
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: selectedSession === session.id.toString() ? '#e7f3ff' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setSelectedSession(session.id.toString())}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '10px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#333', fontSize: '16px', marginBottom: '8px' }}>
                      {session.courseTitle}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                      Преподаватель: {session.teacherName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      Начало: {new Date(session.startTime).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ 
                    padding: '6px 12px',
                    backgroundColor: selectedSession === session.id.toString() ? '#007bff' : '#f8f9fa',
                    color: selectedSession === session.id.toString() ? 'white' : '#666',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    ID: {session.id}
                  </div>
                </div>
                
                {selectedSession === session.id.toString() && (
                  <div style={{ 
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: '#d4edda',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#155724',
                    textAlign: 'center'
                  }}>
                    Выбрано для присоединения
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;