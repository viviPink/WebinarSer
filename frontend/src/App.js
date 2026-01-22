import React, { useState } from 'react';
import TeacherApp from './components/TeacherApp';
import StudentApp from './components/StudentApp';

function App() {
  const [userRole, setUserRole] = useState(null); 

  if (userRole === 'teacher') {
    return <TeacherApp onBack={() => setUserRole(null)} />;
  }

  if (userRole === 'student') {
    return <StudentApp onBack={() => setUserRole(null)} />;
  }

  // Главная страница выбора роли
  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'sans-serif',
      textAlign: 'center',
      maxWidth: '800px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h1 >
          Система проведения вебинаров
        </h1>

        
        <div style={{ 
          display: 'flex', 
          gap: '30px', 
          justifyContent: 'center',
          
        }}>
          {/* Карточка преподавателя */}
          <div style={{
            
            borderRadius: '15px',
            padding: '30px',
            width: '280px',
            
            
      
          }}
          onClick={() => setUserRole('teacher')}
          onMouseEnter={(e) => {
            
            
          }}
          onMouseLeave={(e) => {

          }}
          >
            
            <h3 style={{ color: '#4CAF50', marginBottom: '15px' }}>Преподаватель</h3>
          
          </div>

          {/* Карточка студента */}
          <div style={{
            
            borderRadius: '15px',
            padding: '30px',
            width: '280px',
          }}
          onClick={() => setUserRole('student')}
          onMouseEnter={(e) => {
          }}
          onMouseLeave={(e) => {
          }}
          >
            
            <h3 style={{ color: '#2196F3', marginBottom: '15px' }}>Студент</h3>
            
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;