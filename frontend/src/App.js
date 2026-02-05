import React, { useState } from 'react';
import HomePage from './pages/HomePage';
import TeacherPage from './pages/TeacherPage';
import StudentPage from './pages/StudentPage';

function App() {
  const [userRole, setUserRole] = useState(null);

  if (userRole === 'teacher') {
    return <TeacherPage onBack={() => setUserRole(null)} />;
  }

  if (userRole === 'student') {
    return <StudentPage onBack={() => setUserRole(null)} />;
  }

  return <HomePage setUserRole={setUserRole} />;
}

export default App;