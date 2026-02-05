import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const StudentDashboard = ({ student, onEnterWebinar, onLogout }) => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);

  const loadSessions = async () => {
    try {
      const data = await api.getActiveSessions();
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
      const result = await api.joinSession(student.full_name, student.group, selectedSession);
      if (result.success) {
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

  const handleEnterWebinar = () => {
    if (currentSession) {
      onEnterWebinar(currentSession);
    }
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  if (isJoined && currentSession) {
    return (
      <div className="container" style={{maxWidth: '600px'}}>
        <div className="dashboard-header">
          <div>
            <h2 className="dashboard-title">Панель студента</h2>
            <p className="dashboard-user-info">
              <strong>{student.full_name}</strong> (Группа: {student.group})
            </p>
          </div>
          <button className="button button-secondary" onClick={onLogout}>
            Выйти
          </button>
        </div>

        <div className="card mb-20 text-center" style={{backgroundColor: '#d4edda', borderColor: '#c3e6cb'}}>
          <h3 style={{color: '#155724'}} className="mb-10">
            Вы успешно присоединились к сессии
          </h3>
          <p style={{fontSize: '18px'}} className="mb-15">
            <strong>{currentSession.courseTitle}</strong>
          </p>
          <p style={{color: '#666'}} className="mb-20">
            Преподаватель: {currentSession.teacherName}
          </p>
          <button 
            className="button button-success"
            onClick={handleEnterWebinar}
            style={{boxShadow: '0 2px 4px rgba(0,0,0,0.2)'}}
          >
            Перейти в вебинар
          </button>
        </div>

        <div className="card mb-20">
          <h4 className="section-title">Информация о сессии:</h4>
          <div style={{display: 'grid', gap: '10px'}}>
            <div className="flex justify-between" style={{padding: '8px 0', borderBottom: '1px solid #eee'}}>
              <span style={{fontWeight: 'bold', color: '#666'}}>ID сессии:</span>
              <span>{currentSession.id}</span>
            </div>
            <div className="flex justify-between" style={{padding: '8px 0', borderBottom: '1px solid #eee'}}>
              <span style={{fontWeight: 'bold', color: '#666'}}>Дисциплина:</span>
              <span>{currentSession.courseTitle}</span>
            </div>
            <div className="flex justify-between" style={{padding: '8px 0', borderBottom: '1px solid #eee'}}>
              <span style={{fontWeight: 'bold', color: '#666'}}>Преподаватель:</span>
              <span>{currentSession.teacherName}</span>
            </div>
            <div className="flex justify-between" style={{padding: '8px 0', borderBottom: '1px solid #eee'}}>
              <span style={{fontWeight: 'bold', color: '#666'}}>Начало:</span>
              <span>{new Date(currentSession.startTime).toLocaleString()}</span>
            </div>
            <div className="flex justify-between" style={{padding: '8px 0'}}>
              <span style={{fontWeight: 'bold', color: '#666'}}>Статус:</span>
              <span style={{color: '#28a745', fontWeight: 'bold'}}>Активна</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{maxWidth: '600px'}}>
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Панель студента</h2>
          <p className="dashboard-user-info">
            <strong>{student.full_name}</strong> (Группа: {student.group})
          </p>
        </div>
        <button className="button button-danger" onClick={onLogout}>
          Выйти
        </button>
      </div>

      <div className="card mb-30" style={{backgroundColor: '#e7f3ff', borderColor: '#b3d9ff'}}>
        <h3 style={{color: '#007bff'}} className="section-title">Присоединиться к вебинару</h3>
        <div className="mb-20">
          <select
            className="input"
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
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
          className={`button w-100 ${!selectedSession || loading ? 'button-secondary' : 'button-success'}`}
          onClick={handleJoinSession}
          disabled={!selectedSession || loading}
        >
          {loading ? 'Присоединение...' : 'Присоединиться к вебинару'}
        </button>
        
        {error && (
          <div className="alert alert-error mt-15">
            {error}
          </div>
        )}
      </div>

      {/* Список доступных сессий */}
      <div className="card mb-30">
        <div className="flex justify-between items-center mb-20">
          <h3 className="section-title" style={{margin: 0}}>Доступные вебинары ({sessions.length})</h3>
          <button className="button button-secondary" onClick={loadSessions}>
            Обновить
          </button>
        </div>
        
        {sessions.length === 0 ? (
          <div className="text-center" style={{padding: '40px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '2px dashed #dee2e6'}}>
            <p style={{color: '#666'}} className="mb-10">Нет доступных вебинаров</p>
          </div>
        ) : (
          <div style={{maxHeight: '400px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '6px'}}>
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="p-20"
                style={{ 
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: selectedSession === session.id.toString() ? '#e7f3ff' : 'white',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedSession(session.id.toString())}
              >
                <div className="flex justify-between items-start mb-10">
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 'bold', fontSize: '16px'}} className="mb-8">
                      {session.courseTitle}
                    </div>
                    <div style={{fontSize: '14px', color: '#666'}} className="mb-5">
                      Преподаватель: {session.teacherName}
                    </div>
                    <div style={{fontSize: '12px', color: '#999'}}>
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
                  <div className="alert alert-success mt-15">
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