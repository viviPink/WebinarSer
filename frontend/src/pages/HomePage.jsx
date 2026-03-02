import React from 'react';

const AppView = ({ setUserRole, onRegister }) => {
  const handleLogin = (role, e) => {
    e.stopPropagation();
    // Переход в основной интерфейс после входа
    setUserRole(role);
  };

  const handleRegister = (role, e) => {
    e.stopPropagation();
    // Переход на регистрацию
    if (onRegister) {
      onRegister(role);
    } else {
      alert(`Регистрация: ${role === 'teacher' ? 'Преподаватель' : 'Студент'}`);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div className="logo"></div>
        <span className="title">ВебРум</span>
      </div>

      <div className="content">
        <h1 className="heading">Выберите свою роль</h1>
        <p className="subheading">
         Вебинары в офлайн формате
        </p>

        <div className="cards">
          <div className="card">
            <div className="card-icon"></div>
            <div className="decorative-circle circle-top"></div>
            <h3 className="card-title">Преподаватель</h3>
            
          
            <div className="buttons-container">
              <button 
                className="btn btn-login"
                onClick={(e) => handleLogin('teacher', e)}
              >
                Вход
              </button>
              <button 
                className="btn btn-register"
                onClick={(e) => handleRegister('teacher', e)}
              >
                Регистрация
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-icon"></div>
            <div className="decorative-circle circle-bottom"></div>
            <h3 className="card-title">Студент</h3>
      
            <div className="buttons-container">
              <button 
                className="btn btn-login"
                onClick={(e) => handleLogin('student', e)}
              >
                Вход
              </button>
              <button 
                className="btn btn-register"
                onClick={(e) => handleRegister('student', e)}
              >
                Регистрация
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .container {
          min-height: 100vh;
          background-color: #f0f5ff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .header {
          background-color: #fff;
          padding: 20px 40px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .logo {
          width: 48px;
          height: 48px;
          background-color: #7B61FF;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .title {
          font-size: 24px;
          font-weight: 700;
          color: #000;
        }
        .content {
          padding: 60px 40px;
          text-align: center;
          max-width: 1400px;
          margin: 0 auto;
        }
        .heading {
          font-size: 48px;
          font-weight: 700;
          margin: 0 0 16px 0;
          color: #000;
        }
        .subheading {
          font-size: 20px;
          color: #6B7280;
          margin: 0 0 60px 0;
        }
        .cards {
          display: flex;
          gap: 40px;
          justify-content: center;
          align-items: stretch;
          flex-wrap: nowrap;
        }
        .card {
          background-color: #fff;
          border-radius: 24px;
          padding: 40px;
          width: 480px;
          min-height: 400px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          text-align: left;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
        }
        .card-icon {
          width: 64px;
          height: 64px;
          background-color: #7B61FF;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          font-size: 32px;
        }
        .decorative-circle {
          position: absolute;
          width: 160px;
          height: 160px;
          background-color: #d1d5db;
          border-radius: 50%;
          opacity: 0.6;
        }
        .circle-top {
          top: -40px;
          right: -40px;
        }
        .circle-bottom {
          bottom: -40px;
          right: -40px;
        }
        .card-title {
          font-size: 28px;
          font-weight: 700;
          color: #000;
          margin: 0 0 16px 0;
        }
        .card-text {
          font-size: 16px;
          color: #6B7280;
          line-height: 1.6;
          margin: 0 0 32px 0;
          flex-grow: 1;
        }
        .buttons-container {
          display: flex;
          gap: 12px;
          margin-top: auto;
        }
        .btn {
          flex: 1;
          padding: 14px 24px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-login {
          background-color: #7B61FF;
          color: white;
        }
        .btn-login:hover {
          background-color: #6750E0;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(123, 97, 255, 0.3);
        }
        .btn-register {
          background-color: #e5e7eb;
          color: #374151;
        }
        .btn-register:hover {
          background-color: #d1d5db;
          transform: translateY(-2px);
        }
        .btn:active {
          transform: translateY(0);
        }
        @media (max-width: 1100px) {
          .cards {
            flex-wrap: wrap;
          }
          .card {
            width: 100%;
            max-width: 520px;
          }
        }
      `}</style>
    </div>
  );
};

export default AppView;