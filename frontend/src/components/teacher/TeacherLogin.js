import React, { useState } from 'react';
import TeacherLoginView from './TeacherLoginView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:3001';

const TeacherLogin = ({ setTeacher, onBack }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Заполните все поля');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      
      if (!response.ok) {
        throw new Error('Ошибка сервера');
      }
      
      const data = await response.json();
      if (data.id) {
        setTeacher(data);
      }
    } catch (err) {
      console.error('Ошибка входа:', err);
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TeacherLoginView
      name={name}
      setName={setName}
      email={email}
      setEmail={setEmail}
      error={error}
      loading={loading}
      handleLogin={handleLogin}
      onBack={onBack}
    />
  );
};

export default TeacherLogin;