import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [isTeacher, setIsTeacher] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    group: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let response;
      
      if (isTeacher) {
        // Логин преподавателя
        response = await axios.post('/api/teacher/login', {
          name: formData.name,
          email: formData.email
        });
        onLogin(response.data, true);
      } else {
        // Логин студента
        response = await axios.post('/api/student/login', {
          name: formData.name,
          group: formData.group
        });
        onLogin(response.data, false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🎓 Система вебинаров</h1>
        
        <div className="role-selector">
          <button 
            className={`role-btn ${isTeacher ? 'active' : ''}`}
            onClick={() => setIsTeacher(true)}
          >
            Преподаватель
          </button>
          <button 
            className={`role-btn ${!isTeacher ? 'active' : ''}`}
            onClick={() => setIsTeacher(false)}
          >
            Студент
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>ФИОооооо:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Иванов Иван Иванович"
              required
            />
          </div>

          {isTeacher ? (
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="teacher@example.com"
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Группа:</label>
              <input
                type="text"
                name="group"
                value={formData.group}
                onChange={handleInputChange}
                placeholder="ИТ-21"
                required
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="login-btn"
            disabled={loading}
          >
            {loading ? 'Загрузка...' : isTeacher ? 'Войти как преподаватель' : 'Войти как студент'}
          </button>

          <div className="login-info">
            {isTeacher ? (
              <p></p>
            ) : (
              <p></p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;