import React from 'react';

const TeacherDashboardView = ({
  teacher,
  onLogout,
  onEnterWebinar,
  courses,
  sessions,
  newCourseTitle,
  setNewCourseTitle,
  selectedCourse,
  setSelectedCourse,
  error,
  setError,  
  loading,
  handleCreateCourse,
  handleCreateSession,
  handleFinishSession,
  loadSessions
}) => {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'sans-serif',
      backgroundColor: '#a1aebc',
      minHeight: '100vh'
    }}>
      {/* Шапка */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: 'white'
      }}>
        <div>
          
          <p style={{ color: '#050404', margin: '5px 0 0 0' }}>
            <strong>{teacher.name}</strong> (ID: {teacher.id})
          </p>
        </div>
        <button 
          onClick={onLogout}
          style={{ 
            padding: '8px 16px',
            backgroundColor: '#100d0d',
            color: 'white',
            
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
        backgroundColor: '#fefdfd', 
        
        
      }}>
        <h3 style={{ color: '#0a0909', marginBottom: '15px' }}>Создать новый курс</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input
            placeholder="Название курса"
            value={newCourseTitle}
            onChange={(e) => setNewCourseTitle(e.target.value)}
            style={{ 
              flex: 1, 
              padding: '12px',
              fontSize: '16px'
            }}
          />
          <button 
            onClick={handleCreateCourse}
            disabled={!newCourseTitle.trim()}
            style={{ 
              padding: '12px 24px',
              backgroundColor: "#0a0909",
              color: 'white',
              
              
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
            backgroundColor: 'white'
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
                
                padding: '20px', 
                
                backgroundColor: 'white',
              }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>{course.title}</h4>
                <button 
                  onClick={() => setSelectedCourse(course.id)}
                  style={{ 
                    width: '100%',
                    padding: '10px',
                    backgroundColor:'#080809',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginBottom: '10px'
                  }}
                >
                  {selectedCourse === course.id ? '' : 'Выбрать для сессии'}
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
        backgroundColor: '#ffffff',
        
        
      }}>
        <h3 style={{ color: '#333', marginBottom: '15px' }}>Создать сессию вебинара</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setError('');  // <-- теперь работает
            }}
            style={{ 
              padding: '12px', 
              width: '100%', 
              maxWidth: '500px',
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
            backgroundColor: '#0a0909',
            color: 'white',
            
            
            fontSize: '16px',
            cursor: selectedCourse && !loading ? 'pointer' : 'not-allowed'
          }}
        >
          {loading ? 'Создание' : 'Создать сессию вебинара'}
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
              backgroundColor: '#030303',
              color: 'white',
              
              
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
                padding: '25px', 
                backgroundColor: 'white',
                
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>
                      {session.courseTitle}
                    </h4>
                    
                    <div style={{ 
                      
                      
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
                        <div style={{ color: '#0e0f0e', fontWeight: 'bold' }}>Активна</div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column', minWidth: '150px' }}>
                    <button 
                      onClick={() => onEnterWebinar(session.id)}
                      style={{ 
                        padding: '10px 16px', 
                        backgroundColor: '#020202', 
                        color: 'white', 
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
                        backgroundColor: '#000000', 
                        color: 'white', 
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

      }}>
        <h3 style={{ color: '#333', marginBottom: '20px' }}>Статистика</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px'
        }}>
          
          
        </div>
      </div>

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f4eced', 
          color: '#721c24',
          
          
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboardView;