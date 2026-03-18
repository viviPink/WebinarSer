// AttendanceReports.js
import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://192.168.0.17:3001';

const AttendanceReports = ({ teacher }) => {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'sessionDate', direction: 'desc' });
  
  const [filters, setFilters] = useState({
    courseId: '',
    sessionId: '',
    group: '',
    studentName: '',
    studentId: '',
    dateFrom: '',
    dateTo: ''
  });
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSessions: 0,
    averageAttendance: 0,
    uniqueGroups: 0
  });

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (filters.courseId) {
      loadSessionsByCourse(filters.courseId);
    } else {
      setSessions([]);
    }
  }, [filters.courseId]);

  const loadCourses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher/${teacher.id}/courses`);
      if (!response.ok) throw new Error('Ошибка загрузки курсов');
      const data = await response.json();
      setCourses(data);
    } catch (err) {
      console.error('Ошибка загрузки курсов:', err);
      setError('Не удалось загрузить курсы');
    }
  };

  const loadSessionsByCourse = async (courseId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}/sessions`);
      if (!response.ok) throw new Error('Ошибка загрузки сессий');
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      console.error('Ошибка загрузки сессий:', err);
    }
  };

  const loadAttendanceData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.courseId) params.append('courseId', filters.courseId);
      if (filters.sessionId) params.append('sessionId', filters.sessionId);
      if (filters.group) params.append('group', filters.group);
      if (filters.studentName) params.append('studentName', filters.studentName);
      if (filters.studentId) params.append('studentId', filters.studentId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await fetch(
        `${API_BASE_URL}/api/teacher/${teacher.id}/attendance/report?${params}`
      );
      
      if (!response.ok) throw new Error('Ошибка загрузки данных');
      
      const data = await response.json();
      setAttendanceData(data.attendance);
      setStats(data.stats);
    } catch (err) {
      console.error('Ошибка загрузки посещаемости:', err);
      setError('Не удалось загрузить данные о посещаемости');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      courseId: '',
      sessionId: '',
      group: '',
      studentName: '',
      studentId: '',
      dateFrom: '',
      dateTo: ''
    });
    setSessions([]);
    setTimeout(() => loadAttendanceData(), 100);
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = React.useMemo(() => {
    let sortableItems = [...attendanceData];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [attendanceData, sortConfig]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    const headers = ['Студент', 'Группа', 'Курс', 'Лекция', 'Дата', 'Время входа', 'Статус'];
    const csvData = attendanceData.map(item => [
      item.studentName,
      item.group,
      item.courseTitle,
      `Лекция ${formatDate(item.sessionDate)}`,
      formatDate(item.sessionDate),
      formatDate(item.joinTime),
      item.status || 'Присутствовал'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0 }}>Отчёты по посещаемости</h2>
        <div>
          <button
            onClick={exportToCSV}
            disabled={attendanceData.length === 0}
            style={{ 
              marginRight: '10px', 
              padding: '8px 16px', 
              backgroundColor: attendanceData.length === 0 ? '#999' : '#000', 
              color: '#fff', 
              border: '1px solid #000',
              cursor: attendanceData.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Экспорт в CSV
          </button>
          <button
            onClick={loadAttendanceData}
            disabled={loading}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: loading ? '#999' : '#000', 
              color: '#fff', 
              border: '1px solid #000',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Обновить
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
        <div style={{ border: '1px solid #000', padding: '15px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.totalStudents}</div>
          <div>Всего студентов</div>
        </div>
        <div style={{ border: '1px solid #000', padding: '15px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.totalSessions}</div>
          <div>Всего лекций</div>
        </div>
        <div style={{ border: '1px solid #000', padding: '15px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.averageAttendance}%</div>
          <div>Средняя посещаемость</div>
        </div>
        <div style={{ border: '1px solid #000', padding: '15px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.uniqueGroups}</div>
          <div>Групп</div>
        </div>
      </div>

      {/* Фильтры */}
      <div style={{ border: '1px solid #000', padding: '20px', marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0 }}>Фильтры</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Курс:</label>
            <select 
              name="courseId" 
              value={filters.courseId} 
              onChange={handleFilterChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #000' }}
            >
              <option value="">Все курсы</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Лекция:</label>
            <select 
              name="sessionId" 
              value={filters.sessionId} 
              onChange={handleFilterChange}
              disabled={!filters.courseId}
              style={{ width: '100%', padding: '8px', border: '1px solid #000' }}
            >
              <option value="">Все лекции</option>
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.title || `Лекция ${formatDate(session.startTime)}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Группа:</label>
            <input
              type="text"
              name="group"
              value={filters.group}
              onChange={handleFilterChange}
              placeholder="Например: ИС-201"
              style={{ width: '100%', padding: '8px', border: '1px solid #000' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ФИО студента:</label>
            <input
              type="text"
              name="studentName"
              value={filters.studentName}
              onChange={handleFilterChange}
              placeholder="Введите ФИО"
              style={{ width: '100%', padding: '8px', border: '1px solid #000' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ID студента:</label>
            <input
              type="text"
              name="studentId"
              value={filters.studentId}
              onChange={handleFilterChange}
              placeholder="ID студента"
              style={{ width: '100%', padding: '8px', border: '1px solid #000' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Дата с:</label>
            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #000' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Дата по:</label>
            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #000' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={loadAttendanceData}
            disabled={loading}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: loading ? '#999' : '#000', 
              color: '#fff', 
              border: '1px solid #000',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Применить фильтры
          </button>
          <button 
            onClick={resetFilters}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#666', 
              color: '#fff', 
              border: '1px solid #000',
              cursor: 'pointer'
            }}
          >
            Сбросить
          </button>
        </div>
      </div>

      {/* Таблица посещаемости */}
      <div>
        <h3>Детальная информация</h3>
        {loading && <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка...</div>}
        {error && <div style={{ padding: '20px', textAlign: 'center' }}>{error}</div>}
        
        {!loading && attendanceData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', border: '1px solid #000' }}>
            <p>Нет данных для отображения</p>
            <p>Используйте фильтры для поиска</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
              <thead>
                <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                  <th onClick={() => requestSort('studentName')} style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', cursor: 'pointer' }}>
                    Студент {sortConfig.key === 'studentName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => requestSort('group')} style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', cursor: 'pointer' }}>
                    Группа {sortConfig.key === 'group' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => requestSort('courseTitle')} style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', cursor: 'pointer' }}>
                    Курс {sortConfig.key === 'courseTitle' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => requestSort('sessionDate')} style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', cursor: 'pointer' }}>
                    Дата лекции {sortConfig.key === 'sessionDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => requestSort('joinTime')} style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', cursor: 'pointer' }}>
                    Время входа {sortConfig.key === 'joinTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000' }}>
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((item, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f5f5f5' }}>
                    <td style={{ padding: '12px', border: '1px solid #000' }}>{item.studentName}</td>
                    <td style={{ padding: '12px', border: '1px solid #000' }}>{item.group}</td>
                    <td style={{ padding: '12px', border: '1px solid #000' }}>{item.courseTitle}</td>
                    <td style={{ padding: '12px', border: '1px solid #000' }}>{formatDate(item.sessionDate)}</td>
                    <td style={{ padding: '12px', border: '1px solid #000' }}>{formatDate(item.joinTime)}</td>
                    <td style={{ padding: '12px', border: '1px solid #000' }}>
                      {item.status || 'Присутствовал'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceReports;