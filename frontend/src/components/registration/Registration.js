import React, { useState } from 'react';
import RegistrationView from './RegistrationView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://192.168.0.17:3001';

const Registration = ({ setTeacher, setStudent, onBack }) => {
  const [userType, setUserType] = useState('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mail, setMail] = useState('');
  const [id, setId] = useState('');
  const [group, setGroup] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (userType === 'teacher') {
      if (!id.trim() || !mail.trim() || !email.trim()) {
        setError('Заполните все поля');
        return;
      }
    } else {
      if (!name.trim() || !group.trim()) {
        setError('Заполните все поля');
        return;
      }
    }

    setError('');
    setLoading(true);

    try {
      const endpoint = userType === 'teacher'
        ? '/api/teacher/register'
        : '/api/student/register';

      const body = userType === 'teacher'
        ? { id, mail, email }
        : { name, group };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error('Ошибка сервера');
      }

      const data = await response.json();
      if (data.id) {
        if (userType === 'teacher') {
          setTeacher(data);
        } else {
          setStudent(data);
        }
      }
    } catch (err) {
      console.error('Ошибка регистрации:', err);
      setError('Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegistrationView
      userType={userType}
      setUserType={setUserType}
      name={name}
      setName={setName}
      email={email}
      setEmail={setEmail}
      mail={mail}
      setMail={setMail}
      id={id}
      setId={setId}
      group={group}
      setGroup={setGroup}
      error={error}
      loading={loading}
      handleRegister={handleRegister}
      onBack={onBack}
    />
  );
};

export default Registration;