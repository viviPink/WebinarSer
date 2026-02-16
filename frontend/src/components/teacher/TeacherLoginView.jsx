import React from 'react';

const TeacherLoginView = ({
  name,
  setName,
  email,
  setEmail,
  error,
  loading,
  handleLogin,
  onBack
}) => {
  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'sans-serif', 
      maxWidth: '600px', 
      margin: '0 auto',
      backgroundColor: '#e8d2b9',
      minHeight: '100vh'
    }}>
      <button 
        onClick={onBack}
        style={{ 
          marginBottom: '20px', 
          padding: '8px 16px',
          backgroundColor: '#93918b',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        Назад к выбору роли
      </button>
      
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
       
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
          Вход преподавателя
        </h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            Ваше ФИО:
          </label>
          <input
            
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '16px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            Email:
          </label>
          <input
            
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '16px'
            }}
          />
        </div>
        
        {error && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f8d7da', 
            color: '#721c24',
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
        
        <button 
          onClick={handleLogin}
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '15px', 
            backgroundColor:'#0a0909', 
            color: 'white', 
            fontSize: '16px',
            
            marginBottom: '15px'
          }}
        >
          {loading ? 'Вход' : 'Войти как преподаватель'}
        </button>
      </div>
    </div>
  );
};

export default TeacherLoginView;