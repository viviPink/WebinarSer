import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StudentDashboard = ({ student, onLogout }) => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsRes, historyRes] = await Promise.all([
        axios.get('/api/student/sessions/active'),
        axios.get(`/api/student/${student.id}/attendance`)
      ]);
      setActiveSessions(sessionsRes.data);
      setAttendanceHistory(historyRes.data);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    }
  };

  const handleJoinSession = async (sessionId) => {
    setLoading(true);
    
    try {
      const response = await axios.post('/api/student/sessions/join', {
        studentId: student.id,
        sessionId
      });
      
      if (response.data.alreadyJoined) {
        alert('Вы уже присоединились к этой сессии');
      } else {
        alert('Вы успешно присоединились к сессии!');
        loadData();
      }
    } catch (err) {
      alert('Ошибка присоединения к сессии');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      {/* Шапка */}
      <header className="dashboard-header">
        <div>
          <h1>Панель студента</h1>
          <p>{student.full_name} (Группа: {student.group})</p>
        </div>
        <button onClick={onLogout} className="logout-btn">Выйти</button>
      </header>

      <div className="dashboard-content">
        {/* Доступные сессии */}
        <section className="section">
          <div className="section-header">
            <h2>Доступные вебинары</h2>
            <button onClick={loadData} className="btn-secondary">Обновить</button>
          </div>

          {activeSessions.length === 0 ? (
            <p className="empty-message">Нет доступных вебинаров</p>
          ) : (
            <div className="sessions-grid">
              {activeSessions.map(session => {
                const alreadyJoined = attendanceHistory.some(a => a.sessionId === session.id);
                
                return (
                  <div key={session.id} className="session-card">
                    <h3>{session.courseTitle}</h3>
                    <p>Преподаватель: {session.teacherName}</p>
                    <p>Начало: {new Date(session.startTime).toLocaleString()}</p>
                    <p>ID сессии: {session.id}</p>
                    
                    <button
                      onClick={() => handleJoinSession(session.id)}
                      disabled={loading || alreadyJoined}
                      className={alreadyJoined ? 'btn-success' : 'btn-primary'}
                    >
                      {loading ? 'Присоединение...' : 
                       alreadyJoined ? '✓ Присоединен' : 'Присоединиться'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* История посещений */}
        <section className="section">
          <h2>История посещений</h2>
          
          {attendanceHistory.length === 0 ? (
            <p className="empty-message">Вы еще не посещали вебинары</p>
          ) : (
            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>Курс</th>
                    <th>Преподаватель</th>
                    <th>Время входа</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.map(record => (
                    <tr key={record.id}>
                      <td>{record.courseTitleFull}</td>
                      <td>{record.teacherName}</td>
                      <td>{new Date(record.joinTime).toLocaleString()}</td>
                      <td>
                        <span className="status-joined">Посетил</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Статистика студента */}
        <section className="section">
          <h2>Ваша статистика</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{attendanceHistory.length}</h3>
              <p>Посещено вебинаров</p>
            </div>
            <div className="stat-card">
              <h3>{new Set(attendanceHistory.map(a => a.teacherName)).size}</h3>
              <p>Преподавателей</p>
            </div>
            <div className="stat-card">
              <h3>{new Set(attendanceHistory.map(a => a.courseTitleFull)).size}</h3>
              <p>Разных курсов</p>
            </div>
            <div className="stat-card">
              <h3>{activeSessions.length}</h3>
              <p>Доступно сейчас</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentDashboard;