import React from 'react';
import Header from '../../components/common/Header';
import Participants from '../../components/common/Participants';
import Chat from '../../components/common/Chat';
import AudioRecorder from '../../components/webinar/AudioRecorder';
import TranscriptionModal from '../../components/webinar/TranscriptionModal';

const WebinarTeacherView = ({
  sessionId,
  teacher,
  onExit,
  messages,
  newMessage,
  setNewMessage,
  participants,
  studentsForMonitoring,
  connectionStatus,
  localStream,
  studentScreenStreams,  
  isTeacherBroadcasting,
  activeStudentScreen,
  pendingScreenRequests,
  recordings,
  transcriptions,
  transcribing,
  editingTranscription,
  messagesEndRef,
  studentVideoRef,
  teacherVideoRef,
  socketRef,
  startTeacherScreenShare,
  stopTeacherScreenShare,
  requestStudentScreen,
  stopWatchingStudentScreen,
  fetchRecordings,
  handleOpenTranscriptionEditor,
  handleCloseTranscriptionEditor,
  handleSaveTranscription,
  formatTime,
  playRecording,
  deleteRecording,
  transcribeRecording,
  sendMessage,
  finishWebinar
}) => {
  const renderStudentWithControls = (student) => (
    <div key={'student-' + student.userId + '-' + student.socketId} style={{
      padding: '15px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #dee2e6'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{
          width: '10px',
          height: '10px',
          backgroundColor: '#28a745',
          borderRadius: '50%',
          marginRight: '10px'
        }} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '16px' }}>{student.userName}</strong>
          <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
            ID: {student.userId}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={() => setNewMessage('@' + student.userName + ' ')}
          style={{ 
            padding: '6px 12px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none',
            fontSize: '12px', 
            cursor: 'pointer' 
          }}
        >
          Написать
        </button>
        <button
          onClick={() => requestStudentScreen(student.socketId, student.userName)}
          disabled={activeStudentScreen?.studentSocketId === student.socketId}
          style={{
            padding: '6px 12px',
            backgroundColor: activeStudentScreen?.studentSocketId === student.socketId ? '#6c757d' : '#010101',
            color: 'white',
            border: 'none',
            fontSize: '12px',
            cursor: activeStudentScreen?.studentSocketId === student.socketId ? 'not-allowed' : 'pointer'
          }}
        >
          {activeStudentScreen?.studentSocketId === student.socketId ? 'Смотрит экран' : 'Запросить экран'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f0f2f5' }}>
      {/* Левая колонка - контент */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
        <Header
          title="Вебинар - Преподаватель"
          subtitle={'Сессия ID: ' + sessionId}
          additionalInfo={'Студентов: ' + studentsForMonitoring.length}
          onBack={() => {
            if (window.confirm('Вы уверены, что хотите выйти? Вебинар продолжит работать.')) {
              onExit();
            }
          }}
          backButtonText="Выйти"
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={finishWebinar} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
              Завершить вебинар
            </button>
          </div>
        </Header>

        {/* Основной блок с видео */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '20px',
          marginBottom: '30px'
        }}>
          
          {/* Блок трансляции преподавателя */}
          {isTeacherBroadcasting && localStream && (
            <div style={{ 
              backgroundColor: 'white',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px', 
                backgroundColor: '#0c0d0f', 
                color: 'white' 
              }}>
                <div style={{ fontWeight: 'bold' }}>
                  Ваш экран 
                </div>
                <button 
                  onClick={stopTeacherScreenShare}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: 'rgba(255,255,255,0.2)', 
                    color: 'white', 
                    border: '1px solid white',
                    cursor: 'pointer', 
                    fontWeight: 'bold', 
                    fontSize: '14px' 
                  }}
                >
                  Остановить
                </button>
              </div>
              <div style={{ 
                width: '100%', 
                height: '300px',
                backgroundColor: '#000',
                position: 'relative'
              }}>
                <video
                  ref={teacherVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>
            </div>
          )}

          {/* Блок экрана студента */}
          {activeStudentScreen && studentScreenStreams.get(activeStudentScreen.studentSocketId) && (
            <div style={{ 
              backgroundColor: 'white',
              border: '3px solid #0c0b0a'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px', 
                backgroundColor: '#100e0c', 
                color: 'white' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    Экран студента: {activeStudentScreen.studentName}
                  </span>
                  <span style={{ 
                    backgroundColor: 'rgba(255,255,255,0.3)', 
                    padding: '4px 8px', 
                    fontSize: '12px'
                  }}>
                    {activeStudentScreen.studentSocketId}
                  </span>
                </div>
                <button 
                  onClick={stopWatchingStudentScreen}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: 'white', 
                    color: '#040403', 
                    border: 'none',
                    cursor: 'pointer', 
                    fontWeight: 'bold', 
                    fontSize: '14px' 
                  }}
                >
                  Остановить просмотр
                </button>
              </div>
              <div style={{ 
                width: '100%', 
                height: '400px',
                backgroundColor: '#000',
                position: 'relative'
              }}>
                <video 
                  ref={studentVideoRef}
                  autoPlay 
                  playsInline 
                  muted={false}
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Управление трансляцией */}
        <div style={{ backgroundColor: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #dee2e6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {isTeacherBroadcasting ? (
              <button onClick={stopTeacherScreenShare} style={{ padding: '12px 24px', backgroundColor: '#060606', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                Остановить трансляцию экрана
              </button>
            ) : (
              <button onClick={startTeacherScreenShare} style={{ padding: '12px 24px', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                Начать трансляцию экрана
              </button>
            )}
          </div>
        </div>

        {/* Студенты */}
        <div style={{ backgroundColor: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #dee2e6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#333' }}>Студенты ({studentsForMonitoring.length})</h3>
            {pendingScreenRequests.length > 0 && (
              <div style={{ padding: '6px 12px', backgroundColor: '#fff3cd', color: '#856404', fontSize: '14px' }}>
                Ожидание ответа: {pendingScreenRequests.length}
              </div>
            )}
          </div>
          {studentsForMonitoring.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>
              <p style={{ color: '#6c757d' }}>Нет подключенных студентов</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
              {studentsForMonitoring.map(renderStudentWithControls)}
            </div>
          )}
        </div>

        {/* Аудиозаписи */}
        <div style={{ backgroundColor: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0, color: '#333', marginBottom: '15px' }}>Аудиозаписи ({recordings.length})</h3>
          <AudioRecorder 
            sessionId={sessionId}
            teacherId={teacher.id}
            teacherName={teacher.name}
            socketRef={socketRef}
            onRecordingSaved={fetchRecordings}
          />
          {recordings.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>
              <p style={{ color: '#6c757d' }}>Нет аудиозаписей</p>
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {recordings.map((recording) => (
                <div key={recording.id} style={{ padding: '15px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>
                        {recording.title || 'Без названия'}
                        {recording.transcription && (
                          <span style={{ 
                            marginLeft: '10px',
                            padding: '2px 8px',
                            backgroundColor: '#000000',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 'normal'
                          }}>
                            Есть конспект
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                        {recording.description || 'Без описания'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(recording.createdAt).toLocaleString()} | 
                        Длительность: {recording.duration ? formatTime(recording.duration) : 'неизвестно'} | 
                        Размер: {(recording.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </div>
                      
                      {(recording.transcription || transcriptions[recording.id]) && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f4f5f7', maxHeight: '150px', overflowY: 'auto' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px', color: '#495057' }}>Конспект:</div>
                          <div style={{ 
                            whiteSpace: 'pre-wrap', 
                            fontSize: '13px',
                            lineHeight: '1.4',
                            maxHeight: '100px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {recording.transcription || transcriptions[recording.id]}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => playRecording(recording.filePath)}
                        style={{ 
                          padding: '6px 12px', 
                          backgroundColor: '#050607', 
                          color: 'white', 
                          border: 'none',
                          fontSize: '12px', 
                          cursor: 'pointer'
                        }}
                      >
                        Воспроизвести
                      </button>
                      
                      <button 
                        onClick={() => deleteRecording(recording.id)}
                        style={{ 
                          padding: '6px 12px', 
                          backgroundColor: '#070505', 
                          color: 'white', 
                          border: 'none',
                          fontSize: '12px', 
                          cursor: 'pointer'
                        }}
                      >
                        Удалить
                      </button>
                      
                      {!recording.transcription ? (
                        <button 
                          onClick={() => transcribeRecording(recording.id)}
                          disabled={transcribing[recording.id]}
                          style={{ 
                            padding: '6px 12px', 
                            backgroundColor:'#6c757d', 
                            color: 'white', 
                            border: 'none',
                            fontSize: '12px', 
                            cursor: transcribing[recording.id] ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {transcribing[recording.id] ? (
                            'Обработка...'
                          ) : (
                            'Распознать речь'
                          )}
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleOpenTranscriptionEditor(recording.id)}
                          style={{ 
                            padding: '6px 12px', 
                            backgroundColor: '#6c757d', 
                            color: 'white', 
                            border: 'none',
                            fontSize: '12px', 
                            cursor: 'pointer'
                          }}
                        >
                          Редактировать конспект
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Правая колонка - чат */}
      <div style={{ width: '350px', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderLeft: '1px solid #dee2e6' }}>
        <Participants participants={participants} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
          <Chat 
            messages={messages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            sendMessage={sendMessage}
            disabled={!newMessage.trim() || !socketRef.current?.connected}
            placeholder="Введите сообщение..."
          />
        </div>
      </div>

      {editingTranscription && (
        <TranscriptionModal
          recordingId={editingTranscription}
          onClose={handleCloseTranscriptionEditor}
          onSave={handleSaveTranscription}
        />
      )}

      <style>{`
        button:hover {
          opacity: 0.9;
        }
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
          background: #888;
        }
      `}</style>
    </div>
  );
};

export default WebinarTeacherView;