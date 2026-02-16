import React from 'react';

const AppView = ({ setUserRole }) => {
  return (
    <div style={{
      padding: '40px',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      maxWidth: '700px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#e8d2b9'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '90px',
        marginBottom: '30px'
      }}>
        <h1>Система проведения вебинаров</h1>
        <p>Выберите свою роль</p>

        <div style={{
          display: 'flex',
          gap: '50px',
          justifyContent: 'center'
        }}>
          <div
            style={{
              backgroundColor: '#f8f9fa',
              padding: '30px',
              width: '280px'
            }}
            onClick={() => setUserRole('teacher')}
          >
            <h3 style={{ color: '#000', marginBottom: '15px' }}>Преподаватель</h3>
          </div>

          <div
            style={{
              backgroundColor: '#f8f9fa',
              padding: '30px',
              width: '280px'
            }}
            onClick={() => setUserRole('student')}
          >
            <h3 style={{ color: '#000', marginBottom: '15px' }}>Студент</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppView;