import React, { useState, useEffect } from 'react';
import WebinarStudent from './WebinarStudent';

const StudentApp = ({ onBack }) => {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [student, setStudent] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [error, setError] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [currentWebinar, setCurrentWebinar] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Загрузить активные сессии
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

  // Вход студента
  const handleLogin = async () => {
    if (!name.trim() || !group.trim()) {
      setError('Заполните все поля');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, group })
      });
      
      if (!response.ok) {
        throw new Error('Ошибка сервера');
      }
      
      const data = await response.json();
      if (data.id) {
        setStudent(data);
        setError('');
        await loadSessions();
      }
    } catch (err) {
      console.error('Ошибка входа:', err);
      setError('Не удалось войти в систему');
    } finally {
      setLoading(false);
    }
  };

  // Присоединиться к сессии
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
          studentName: name,
          groupName: group,
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
          setError('');
        } else {
          setError('Сессия не найдена');
        }
      }
    } catch (err) {
      console.error('Ошибка присоединения:', err);
      setError('Не удалось присоединиться к сессии');
    } finally {
      setLoading(false);
    }
  };

  // Вход в вебинар
  const handleEnterWebinar = () => {
    if (currentSession) {
      setCurrentWebinar(currentSession.id);
    }
  };

  // Выход из системы студента
  const handleLogout = () => {
    setStudent(null);
    setName('');
    setGroup('');
    setSelectedSession('');
    setCurrentSession(null);
    setIsJoined(false);
    setCurrentWebinar(null);
    setError('');
    setLoading(false);
  };

  useEffect(() => {
    if (student) {
      loadSessions();
      // Обновляем список сессий каждые 15 секунд
      const interval = setInterval(loadSessions, 15000);
      return () => clearInterval(interval);
    }
  }, [student]);

  // Если студент в вебинаре
  if (currentWebinar) {
    return (
      <WebinarStudent 
        sessionId={currentWebinar}
        student={{
          id: student?.id,
          full_name: student?.full_name || name,
          group: student?.group || group
        }}
        onExit={() => setCurrentWebinar(null)}
      />
    );
  }

  // Если студент уже присоединился к сессии
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
              <strong>{name}</strong> (Группа: {group})
            </p>
          </div>
          <button 
            onClick={handleLogout}
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
          
          borderRadius: '8px',
          textAlign: 'center',
          marginBottom: '20px',
          
        }}>
          <h3 style={{ color: '#0a0b0b', marginBottom: '10px' }}>
            Вы успешно присоединились к сессии
          </h3>
          <p style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>
            <strong>{currentSession.courseTitle}</strong>
          </p>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Преподаватель: {currentSession.teacherName}
          </p>
          <button 
            onClick={handleEnterWebinar}
            style={{ 
              padding: '12px 24px', 
              backgroundColor: '#060706', 
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

  // Если студент авторизован, но еще не присоединился к сессии
  if (student) {
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
            onClick={handleLogout}
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
          
          borderRadius: '8px',
          marginBottom: '30px',
          border: '1px solid #0b0a08'
        }}>
          <h3 style={{ color: '#0e0c07', marginBottom: '15px' }}>Присоединиться к вебинару</h3>
          
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
              backgroundColor: (!selectedSession || loading) ? '#6c757d' : '#28a745',
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
              color: '#180c0d',
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
                backgroundColor: '#0a0b0b',
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
  }

  // Форма входа для студента
  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'sans-serif', 
      maxWidth: '500px', 
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa'
    }}>
      <button 
        onClick={onBack}
        style={{ 
          marginBottom: '20px', 
          padding: '8px 16px',
          backgroundColor: '#50d24c',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          
          fontSize: '14px'
        }}
      >
         Назад к выбору роли
      </button>

      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        
      }}>
        <h2 style={{ textAlign: 'center', color: '#000000', marginBottom: '30px' }}>
          Вход для студента
        </h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            Ваше ФИО:
          </label>
          <input
            placeholder=""
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            Название группы:
          </label>
          <input
            placeholder=""
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button 
          onClick={handleLogin}
          disabled={!name.trim() || !group.trim() || loading}
          style={{ 
            width: '100%', 
            padding: '15px', 
            backgroundColor: (!name.trim() || !group.trim() || loading) ? '#6c757d' : '#007bff',
            color: 'white', 
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: (!name.trim() || !group.trim() || loading) ? 'not-allowed' : 'pointer',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Вход...' : 'Войти как студент'}
        </button>
        
        {error && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f8d7da', 
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <div style={{ 
          marginTop: '25px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #dee2e6'
        }}>
          
         
        </div>

        
      </div>
    </div>
  );
};

export default StudentApp;