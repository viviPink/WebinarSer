import React from 'react';

const StudentDashboardView = ({
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
  setError,           // ← ДОБАВЛЕНО!
  handleJoinSession,
  loadSessions
}) => {
  // Если студент присоединился к сессии
  if (isJoined && currentSession) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Панель студента</h2>
            <p style={{ margin: '5px 0 0 0' }}>
              {student.full_name} (Группа: {student.group})
            </p>
          </div>
          <button onClick={onLogout} style={{ padding: '8px 16px', background: 'black', color: 'white'}}>
            Выйти
          </button>
        </div>

        <div style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '10px' }}>
            Вы успешно присоединились к сессии
          </h3>
          <p>
            <strong>{currentSession.courseTitle}</strong>
          </p>
          <p>
            Преподаватель: {currentSession.teacherName}
          </p>
          <button 
            onClick={() => onEnterWebinar(currentSession.id)}
            style={{ padding: '10px 20px', background: 'black', color: 'white', border: 'none' }}
          >
            Перейти в вебинар
          </button>
        </div>

        <div style={{ padding: '20px', border: '1px solid black' }}>
          <h4 style={{ marginBottom: '15px' }}>Информация о сессии:</h4>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span>ID сессии:</span>
              <span>{currentSession.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span>Дисциплина:</span>
              <span>{currentSession.courseTitle}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span>Преподаватель:</span>
              <span>{currentSession.teacherName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span>Начало:</span>
              <span>{new Date(currentSession.startTime).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span>Статус:</span>
              <span>Активна</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Основная панель студента
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Панель студента</h2>
          <p style={{ margin: '5px 0 0 0' }}>
            {student.full_name} (Группа: {student.group})
          </p>
        </div>
        <button onClick={onLogout} style={{ padding: '8px 16px', background: 'black', color: 'white'}}>
          Выйти
        </button>
      </div>

      <div style={{ padding: '20px', border: '1px solid black', marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Присоединиться к вебинару</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <select
            value={selectedSession}
            onChange={(e) => {
              setSelectedSession(e.target.value);
              setError('');           
            }}
            style={{ width: '100%', padding: '8px' }}
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
            padding: '10px', 
            background: 'black',
            color: 'white', 
            border: 'none'
          }}
        >
          {loading ? 'Присоединение...' : 'Присоединиться к вебинару'}
        </button>
        
        {error && (
          <div style={{ marginTop: '15px', padding: '10px'}}>
            {error}
          </div>
        )}
      </div>

      {/* Список доступных сессий */}
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Доступные вебинары</h3>
          <button 
            onClick={loadSessions}
            style={{ padding: '5px 15px', background: 'black', color: 'white', border: 'none' }}
          >
            Обновить
          </button>
        </div>
        
        {sessions.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Нет доступных вебинаров</p>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid black' }}>
            {sessions.map((session) => (
              <div 
                key={session.id} 
                style={{ 
                  padding: '15px', 
                  borderBottom: '1px solid black',
                  background: selectedSession === session.id.toString() ? '#ddd' : 'white'
                }}
                onClick={() => {
                  setSelectedSession(session.id.toString());
                  setError('');        // ← теперь работает!
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      {session.courseTitle}
                    </div>
                    <div style={{ marginBottom: '5px' }}>
                      Преподаватель: {session.teacherName}
                    </div>
                    <div>
                      Начало: {new Date(session.startTime).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '4px 8px', background: 'black', color: 'white' }}>
                    ID: {session.id}
                  </div>
                </div>
                
                {selectedSession === session.id.toString() && (
                  <div style={{ marginTop: '10px', padding: '8px', border: '1px solid black', textAlign: 'center' }}>
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

export default StudentDashboardView;