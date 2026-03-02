// TeacherDashboardView.jsx (обновлённый)
import React, { useState } from 'react';
import AttendanceReports from '../../components/common/AttendanceReports';
import ScheduleSessionModal from '../../components/common/ScheduleSessionModal';
import SessionsCalendar from './SessionsCalendar';
import { formatToLocalDateTime, formatToLocalTime } from '../../utils/dateUtils';

const TeacherDashboardView = ({
  teacher,
  onLogout,
  onEnterWebinar,
  courses,
  sessions,
  scheduledSessions,
  newCourseTitle,
  setNewCourseTitle,
  selectedCourse,
  setSelectedCourse,
  sessionDescription,
  setSessionDescription,
  error,
  setError,  
  loading,
  handleCreateCourse,
  handleCreateSession,
  handleScheduleSession,
  handleFinishSession,
  handleDeleteScheduledSession,
  handleEditScheduledSession,
  loadSessions,
  loadScheduledSessions
}) => {
  const [activeTab, setActiveTab] = useState('webinars');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Стили для компонента
  const styles = {
    container: {
      padding: '20px',
      fontFamily: 'sans-serif',
      backgroundColor: '#a1aebc',
      minHeight: '100vh'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '30px',
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    teacherInfo: {
      color: '#050404',
      margin: 0
    },
    logoutButton: {
      padding: '8px 16px',
      backgroundColor: '#100d0d',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      ':hover': {
        backgroundColor: '#333'
      }
    },
    tabsContainer: {
      marginBottom: '20px',
      display: 'flex',
      gap: '10px',
      backgroundColor: 'white',
      padding: '10px',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    tabButton: (isActive) => ({
      padding: '10px 20px',
      border: 'none',
      background: isActive ? '#333' : '#f0f0f0',
      color: isActive ? 'white' : '#333',
      cursor: 'pointer',
      borderRadius: '4px',
      flex: 1,
      fontSize: '16px',
      transition: 'all 0.3s',
      ':hover': {
        background: isActive ? '#444' : '#e0e0e0'
      }
    }),
    section: {
      marginBottom: '30px',
      padding: '25px',
      backgroundColor: 'white',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    sectionTitle: {
      color: '#333',
      marginBottom: '20px',
      fontSize: '20px',
      fontWeight: 'bold'
    },
    inputGroup: {
      display: 'flex',
      gap: '10px',
      marginBottom: '15px'
    },
    input: {
      flex: 1,
      padding: '12px',
      fontSize: '16px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      ':focus': {
        outline: 'none',
        borderColor: '#007bff'
      }
    },
    textarea: {
      padding: '12px',
      width: '100%',
      maxWidth: '500px',
      fontSize: '16px',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '4px',
      minHeight: '100px',
      resize: 'vertical',
      ':focus': {
        outline: 'none',
        borderColor: '#007bff'
      }
    },
    select: {
      padding: '12px',
      width: '100%',
      maxWidth: '500px',
      fontSize: '16px',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '4px',
      ':focus': {
        outline: 'none',
        borderColor: '#007bff'
      }
    },
    button: (color = '#0a0909', disabled = false) => ({
      padding: '12px 24px',
      backgroundColor: color,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      fontSize: '16px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.3s',
      ':hover': disabled ? {} : {
        opacity: 0.9,
        transform: 'translateY(-1px)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }
    }),
    buttonGroup: {
      display: 'flex',
      gap: '10px'
    },
    coursesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '20px'
    },
    courseCard: {
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '4px',
      border: '1px solid #eee',
      transition: 'all 0.3s',
      ':hover': {
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
      }
    },
    courseTitle: {
      margin: '0 0 15px 0',
      color: '#333',
      fontSize: '18px'
    },
    courseButton: (isSelected) => ({
      width: '100%',
      padding: '10px',
      backgroundColor: isSelected ? '#28a745' : '#080809',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      marginBottom: '10px',
      transition: 'all 0.3s',
      ':hover': {
        opacity: 0.9
      }
    }),
    courseId: {
      fontSize: '12px',
      color: '#666',
      textAlign: 'center'
    },
    sessionsList: {
      display: 'grid',
      gap: '20px'
    },
    sessionCard: {
      padding: '25px',
      backgroundColor: 'white',
      borderRadius: '4px',
      border: '1px solid #eee',
      transition: 'all 0.3s',
      ':hover': {
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
      }
    },
    sessionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    },
    sessionInfo: {
      flex: 1
    },
    sessionMainTitle: {
      margin: '0 0 15px 0',
      color: '#333',
      fontSize: '20px'
    },
    sessionDescription: {
      marginBottom: '15px',
      padding: '10px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
      fontSize: '14px',
      color: '#555'
    },
    sessionDetails: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '15px',
      marginBottom: '20px'
    },
    detailLabel: {
      fontSize: '12px',
      color: '#666',
      marginBottom: '4px'
    },
    detailValue: {
      fontWeight: 'bold',
      fontSize: '16px',
      color: '#333'
    },
    statusActive: {
      color: '#28a745',
      fontWeight: 'bold'
    },
    actionButtons: {
      display: 'flex',
      gap: '10px',
      flexDirection: 'column',
      minWidth: '150px'
    },
    enterButton: {
      padding: '10px 16px',
      backgroundColor: '#060e08',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
    },
    finishButton: {
      padding: '10px 16px',
      backgroundColor: '#0c0909',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
    },
    emptyState: {
      padding: '40px',
      textAlign: 'center',
      backgroundColor: 'white',
      borderRadius: '4px',
      color: '#666'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '20px'
    },
    statItem: {
      textAlign: 'center'
    },
    statLabel: {
      fontSize: '14px',
      color: '#666'
    },
    statValue: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#333'
    },
    errorMessage: {
      marginTop: '20px',
      padding: '15px',
      backgroundColor: '#f8d7da',
      color: '#721c24',
      border: '1px solid #f5c6cb',
      borderRadius: '4px',
      textAlign: 'center'
    },
    calendarHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    refreshButton: {
      padding: '8px 16px',
      backgroundColor: '#030303',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      ':hover': {
        backgroundColor: '#333'
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* Шапка */}
      <div style={styles.header}>
        <div>
          <p style={styles.teacherInfo}>
            <strong>{teacher?.name || 'Преподаватель'}</strong> (ID: {teacher?.id})
          </p>
        </div>
        <button onClick={onLogout} style={styles.logoutButton}>
          Выйти
        </button>
      </div>

      {/* Вкладки */}
      <div style={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('webinars')}
          style={styles.tabButton(activeTab === 'webinars')}
        >
          Вебинары
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          style={styles.tabButton(activeTab === 'calendar')}
        >
          Календарь
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          style={styles.tabButton(activeTab === 'reports')}
        >
          Отчёты
        </button>
      </div>

      {/* Контент вкладок */}
      {activeTab === 'webinars' && (
        /* Вкладка Вебинары */
        <div>
          {/* Создание курса */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Создать новый курс</h3>
            <div style={styles.inputGroup}>
              <input
                placeholder="Название курса"
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                style={styles.input}
              />
              <button 
                onClick={handleCreateCourse}
                disabled={!newCourseTitle.trim() || loading}
                style={styles.button('#0a0909', !newCourseTitle.trim() || loading)}
              >
                Создать курс
              </button>
            </div>
          </div>

          {/* Мои курсы */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Мои курсы ({courses.length})</h3>
            
            {courses.length === 0 ? (
              <div style={styles.emptyState}>
                <p>У вас пока нет курсов</p>
              </div>
            ) : (
              <div style={styles.coursesGrid}>
                {courses.map(course => (
                  <div key={course.id} style={styles.courseCard}>
                    <h4 style={styles.courseTitle}>{course.title}</h4>
                    <button 
                      onClick={() => setSelectedCourse(course.id)}
                      style={styles.courseButton(selectedCourse === course.id)}
                    >
                      {selectedCourse === course.id ? 'Выбран' : 'Выбрать для сессии'}
                    </button>
                    <div style={styles.courseId}>
                      ID: {course.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Создание сессии */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Создать сессию вебинара</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <select
                value={selectedCourse}
                onChange={(e) => {
                  setSelectedCourse(e.target.value);
                  setError('');
                }}
                style={styles.select}
              >
                <option value="">— Выберите курс для вебинара —</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>
            
            {/* Поле для описания сессии */}
            <div style={{ marginBottom: '15px' }}>
              <textarea
                placeholder="Описание сессии (необязательно)"
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                style={styles.textarea}
              />
            </div>

            <div style={styles.buttonGroup}>
              <button 
                onClick={handleCreateSession}
                disabled={!selectedCourse || loading}
                style={styles.button('#0a0909', !selectedCourse || loading)}
              >
                {loading ? 'Создание...' : 'Начать сейчас'}
              </button>
              
              <button 
                onClick={() => setIsScheduleModalOpen(true)}
                disabled={courses.length === 0}
                style={styles.button('#007bff', courses.length === 0)}
              >
                Запланировать
              </button>
            </div>
          </div>

          {/* Активные сессии */}
          <div style={styles.section}>
            <div style={styles.calendarHeader}>
              <h3 style={styles.sectionTitle}>Активные сессии ({sessions.length})</h3>
              <button onClick={loadSessions} style={styles.refreshButton}>
                Обновить
              </button>
            </div>
            
            {sessions.length === 0 ? (
              <div style={styles.emptyState}>
                <p>Нет активных сессий</p>
              </div>
            ) : (
              <div style={styles.sessionsList}>
                {sessions.map(session => (
                  <div key={session.id} style={styles.sessionCard}>
                    <div style={styles.sessionHeader}>
                      <div style={styles.sessionInfo}>
                        <h4 style={styles.sessionMainTitle}>
                          {session.courseTitle}
                        </h4>
                        
                        {/* Отображение описания сессии, если оно есть */}
                        {session.description && (
                          <div style={styles.sessionDescription}>
                            <strong>Описание:</strong> {session.description}
                          </div>
                        )}
                        
                        <div style={styles.sessionDetails}>
                          <div>
                            <div style={styles.detailLabel}>ID сессии:</div>
                            <div style={styles.detailValue}>{session.id}</div>
                          </div>
                          <div>
                            <div style={styles.detailLabel}>Начало:</div>
                            <div style={styles.detailValue}>
                              {formatToLocalDateTime(session.startTime)}
                            </div>
                          </div>
                          <div>
                            <div style={styles.detailLabel}>Статус:</div>
                            <div style={styles.statusActive}>Активна</div>
                          </div>
                        </div>
                      </div>
                      
                      <div style={styles.actionButtons}>
                        <button 
                          onClick={() => onEnterWebinar(session.id)}
                          style={styles.enterButton}
                        >
                          Войти в вебинар
                        </button>
                        <button 
                          onClick={() => handleFinishSession(session.id)}
                          style={styles.finishButton}
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
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Статистика</h3>
            <div style={styles.statsGrid}>
              <div style={styles.statItem}>
                <div style={styles.statLabel}>Всего курсов</div>
                <div style={styles.statValue}>{courses.length}</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statLabel}>Активных сессий</div>
                <div style={styles.statValue}>{sessions.length}</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statLabel}>Запланировано</div>
                <div style={styles.statValue}>{scheduledSessions?.length || 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        /* Вкладка Календарь */
        <div style={styles.section}>
          <div style={styles.calendarHeader}>
            <h3 style={styles.sectionTitle}>Расписание вебинаров</h3>
            <button onClick={loadScheduledSessions} style={styles.refreshButton}>
              Обновить
            </button>
          </div>
          
          <SessionsCalendar
            sessions={sessions}
            scheduledSessions={scheduledSessions}
            onEditSession={handleEditScheduledSession}
            onDeleteSession={handleDeleteScheduledSession}
            onStartSession={onEnterWebinar}
          />
        </div>
      )}

      {activeTab === 'reports' && (
        /* Вкладка Отчёты */
        <div style={styles.section}>
          <AttendanceReports teacher={teacher} />
        </div>
      )}

      {/* Модальное окно планирования */}
      <ScheduleSessionModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        courses={courses}
        onSchedule={handleScheduleSession}
      />

      {/* Ошибки */}
      {error && (
        <div style={styles.errorMessage}>
          {error}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboardView;