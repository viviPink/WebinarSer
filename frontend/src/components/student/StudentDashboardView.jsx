import React, { useState } from 'react';

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
  recordings,
  loadingRecordings,
  formatTime,
  playRecording,
  setSelectedSession,
  setError,
  handleJoinSession,
  loadSessions
}) => {
  const [activeTab, setActiveTab] = useState('webinars');

  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '30px',
      padding: '15px',
      backgroundColor: '#f5f5f5',
      border: '1px solid #ddd'
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    userName: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#333'
    },
    userGroup: {
      fontSize: '14px',
      color: '#666',
      marginLeft: '5px'
    },
    logoutBtn: {
      padding: '8px 16px',
      backgroundColor: '#333',
      color: 'white',
      border: '1px solid #333',
      cursor: 'pointer',
      fontSize: '14px'
    },
    tabs: {
      display: 'flex',
      gap: '2px',
      marginBottom: '20px',
      borderBottom: '1px solid #ddd'
    },
    tab: {
      padding: '10px 20px',
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      color: '#666'
    },
    activeTab: {
      backgroundColor: '#333',
      color: 'white'
    },
    content: {
      backgroundColor: 'white',
      border: '1px solid #ddd',
      padding: '20px'
    },
    sectionTitle: {
      margin: '0 0 20px 0',
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#333'
    },
    sessionList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginBottom: '20px'
    },
    sessionItem: {
      padding: '15px',
      border: '1px solid #ddd',
      cursor: 'pointer',
      backgroundColor: '#f9f9f9'
    },
    selectedSession: {
      border: '2px solid #333',
      backgroundColor: '#f5f5f5'
    },
    sessionTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#333',
      marginBottom: '5px'
    },
    sessionMeta: {
      fontSize: '14px',
      color: '#666'
    },
    joinBtn: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#333',
      color: 'white',
      border: '1px solid #333',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
      marginTop: '10px'
    },
    disabledBtn: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    errorMessage: {
      padding: '10px',
      backgroundColor: '#f5f5f5',
      color: '#333',
      border: '1px solid #ddd',
      marginBottom: '15px'
    },
    recordingsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '20px'
    },
    recordingCard: {
      padding: '15px',
      border: '1px solid #ddd',
      backgroundColor: '#f9f9f9'
    },
    recordingTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#333',
      marginBottom: '10px'
    },
    recordingDetail: {
      fontSize: '14px',
      color: '#666',
      marginBottom: '5px'
    },
    playBtn: {
      width: '100%',
      padding: '8px',
      backgroundColor: '#333',
      color: 'white',
      border: '1px solid #333',
      cursor: 'pointer',
      marginTop: '10px',
      fontSize: '14px'
    },
    loadingSpinner: {
      textAlign: 'center',
      padding: '40px',
      color: '#666'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: '#666',
      backgroundColor: '#f9f9f9',
      border: '1px solid #ddd'
    },
    profileInfo: {
      padding: '20px',
      backgroundColor: '#f9f9f9',
      border: '1px solid #ddd'
    },
    profileRow: {
      display: 'flex',
      marginBottom: '10px',
      padding: '10px',
      borderBottom: '1px solid #ddd'
    },
    profileLabel: {
      width: '100px',
      fontWeight: 'bold',
      color: '#333'
    },
    profileValue: {
      color: '#666'
    },
    refreshBtn: {
      padding: '4px 8px',
      backgroundColor: '#666',
      color: 'white',
      border: '1px solid #666',
      cursor: 'pointer',
      fontSize: '12px',
      marginLeft: '10px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.userInfo}>
          <span style={styles.userName}>{student?.full_name}</span>
          <span style={styles.userGroup}>({student?.group})</span>
        </div>
        <button style={styles.logoutBtn} onClick={onLogout}>
          Выйти
        </button>
      </div>

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'webinars' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('webinars')}
        >
          Вебинары
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'recordings' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('recordings')}
        >
          Записи
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'profile' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('profile')}
        >
          Профиль
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'webinars' && (
          <div>
            <h3 style={styles.sectionTitle}>
              Доступные вебинары
              <button
                style={styles.refreshBtn}
                onClick={loadSessions}
                disabled={loading}
              >
                Обновить
              </button>
            </h3>

            {error && <div style={styles.errorMessage}>{error}</div>}

            {loading && (
              <div style={styles.loadingSpinner}>
                Загрузка...
              </div>
            )}

            {!loading && sessions.length === 0 ? (
              <div style={styles.emptyState}>
                <p>Нет активных вебинаров</p>
              </div>
            ) : (
              <>
                <div style={styles.sessionList}>
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      style={{
                        ...styles.sessionItem,
                        ...(selectedSession === String(session.id) ? styles.selectedSession : {})
                      }}
                      onClick={() => setSelectedSession(String(session.id))}
                    >
                      <div style={styles.sessionTitle}>
                        {session.courseTitle || 'Вебинар'}
                      </div>
                      <div style={styles.sessionMeta}>
                        Преподаватель: {session.teacherName || 'Неизвестно'}
                      </div>
                      <div style={styles.sessionMeta}>
                        Начало: {new Date(session.startTime).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedSession && (
                  <button
                    style={{
                      ...styles.joinBtn,
                      ...(loading || isJoined ? styles.disabledBtn : {})
                    }}
                    onClick={handleJoinSession}
                    disabled={loading || isJoined}
                  >
                    {loading ? 'Присоединение...' : isJoined ? 'Уже в вебинаре' : 'Присоединиться к вебинару'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'recordings' && (
          <div>
            <h3 style={styles.sectionTitle}>Записи вебинаров</h3>
            
            {loadingRecordings ? (
              <div style={styles.loadingSpinner}>Загрузка записей...</div>
            ) : recordings.length === 0 ? (
              <div style={styles.emptyState}>
                <p>Нет доступных записей</p>
              </div>
            ) : (
              <div style={styles.recordingsGrid}>
                {recordings.map(recording => (
                  <div key={recording.id} style={styles.recordingCard}>
                    <div style={styles.recordingTitle}>
                      {recording.title || 'Запись вебинара'}
                    </div>
                    <div style={styles.recordingDetail}>
                      Курс: {recording.courseTitle || 'Неизвестно'}
                    </div>
                    <div style={styles.recordingDetail}>
                      Преподаватель: {recording.teacherName || 'Неизвестно'}
                    </div>
                    <div style={styles.recordingDetail}>
                      Длительность: {formatTime(recording.duration)}
                    </div>
                    <div style={styles.recordingDetail}>
                      Дата: {new Date(recording.createdAt).toLocaleDateString()}
                    </div>
                    {recording.transcription && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px',
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #ddd',
                        fontSize: '13px',
                        maxHeight: '100px',
                        overflow: 'auto',
                        color: '#333'
                      }}>
                        {recording.transcription.substring(0, 150)}
                        {recording.transcription.length > 150 && '...'}
                      </div>
                    )}
                    <button
                      style={styles.playBtn}
                      onClick={() => playRecording(recording.filePath)}
                    >
                      Прослушать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div>
            <h3 style={styles.sectionTitle}>Информация о студенте</h3>
            <div style={styles.profileInfo}>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>ID:</span>
                <span style={styles.profileValue}>{student?.id}</span>
              </div>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>Имя:</span>
                <span style={styles.profileValue}>{student?.full_name}</span>
              </div>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>Группа:</span>
                <span style={styles.profileValue}>{student?.group}</span>
              </div>
              <div style={styles.profileRow}>
                <span style={styles.profileLabel}>Посещено:</span>
                <span style={styles.profileValue}>
                  {recordings.filter(r => r.sessionId).length} вебинаров
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboardView;