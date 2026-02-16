import React, { useState } from 'react';
import StudentLoginView from './StudentLoginView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:3001';

const StudentLogin = ({ setStudent, onBack }) => {
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
      const response = await fetch(`${API_BASE_URL}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, group })
      });
      
      if (!response.ok) {
        throw new Error('Ошибка сервера');
      }
      
      const data = await response.json();
      if (data.id) {
        setStudent(data);
      }
    } catch (err) {
      console.error('Ошибка входа:', err);
      setError('Не удалось войти в систему');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StudentLoginView
      name={name}
      setName={setName}
      group={group}
      setGroup={setGroup}
      error={error}
      loading={loading}
      handleLogin={handleLogin}
      onBack={onBack}
    />
  );
};

export default StudentLogin;