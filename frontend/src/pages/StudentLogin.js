import React, { useState } from 'react';
import { api } from '../services/api';

const StudentLogin = ({ onLogin, onBack }) => {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name.trim() || !group.trim()) {
      setError('Заполните все поля');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const student = await api.loginStudent(name, group);
      onLogin(student);
    } catch (err) {
      console.error('Ошибка входа:', err);
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <button className="button button-secondary back-button" onClick={onBack}>
        Назад к выбору роли
      </button>
      
      <div className="login-card">
        <h2 className="login-title">Вход для студента</h2>
        
        <div className="form-group">
          <label className="label">Ваше ФИО:</label>
          <input
            className="input"
            placeholder="Введите ФИО"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label className="label">Название группы:</label>
          <input
            className="input"
            placeholder="Введите название группы"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
        </div>
        
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}
        
        <button 
          className={`button ${loading ? 'button-secondary' : 'button-success'} w-100`}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Вход...' : 'Войти как студент'}
        </button>
      </div>
    </div>
  );
};

export default StudentLogin;