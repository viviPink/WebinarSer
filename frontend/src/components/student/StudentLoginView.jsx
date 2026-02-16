import React from 'react';

const StudentLoginView = ({
  name,
  setName,
  group,
  setGroup,
  error,
  loading,
  handleLogin,
  onBack
}) => {
  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'sans-serif', 
      maxWidth: '500px', 
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa'
    }}>
      <button 
        onClick={onBack}
        style={{ 
          marginBottom: '20px', 
          padding: '8px 16px',
          backgroundColor: '#6c757d',
          color: 'white',
          fontSize: '14px'
        }}
      >
        Назад к выбору роли
      </button>

      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        
      }}>
        <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>
          Вход для студента
        </h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            Ваше ФИО:
          </label>
          <input
            placeholder="Петров Петр Петрович"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            Название группы:
          </label>
          <input
            
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              
              
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button 
          onClick={handleLogin}
          disabled={!name.trim() || !group.trim() || loading}
          style={{ 
            width: '100%', 
            padding: '15px', 
            backgroundColor:'#b5bbb7',
            color: 'white', 
            fontSize: '16px',
            
            marginBottom: '15px'
          }}
        >
          {loading ? 'Вход...' : 'Войти как студент'}
        </button>
        
        {error && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f8d7da', 
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentLoginView;