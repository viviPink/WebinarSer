import React from 'react';

const HomePage = ({ setUserRole }) => {
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
        <h1 style={{ marginBottom: '30px' }}>
          Система проведения вебинаров
        </h1>

        
        <div style={{ 
          display: 'flex', 
          gap: '30px', 
          justifyContent: 'center',
          
        }}>
          {/* Карточка преподавателя */}
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '15px',
            padding: '30px',
            width: '280px',
            cursor: 'pointer',
            border: '2px solid #4CAF50',
            transition: 'transform 0.3s'
          }}
          onClick={() => setUserRole('teacher')}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            
            <h3 style={{ color: '#4CAF50', marginBottom: '15px' }}>Преподаватель</h3>
          
          </div>

          {/* Карточка студента */}
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '15px',
            padding: '30px',
            width: '280px',
            cursor: 'pointer',
            border: '2px solid #2196F3',
            transition: 'transform 0.3s'
          }}
          onClick={() => setUserRole('student')}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            
            <h3 style={{ color: '#2196F3', marginBottom: '15px' }}>Студент</h3>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;