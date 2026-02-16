import React from 'react';

const WebinarStudentView = ({
  sessionId,
  student,
  onExit,
  messages,
  newMessage,
  setNewMessage,
  participants,
  connectionStatus,
  teacherPresent,
  teacherName,
  teacherScreenActive,
  teacherScreenStream,
  localStream,
  isSharingScreen,
  incomingScreenRequest,
  setIncomingScreenRequest,
  messagesEndRef,
  teacherVideoRef,
  sendMessage,
  trackActivity,
  startStudentScreenShare,
  stopStudentScreenShare,
  socketRef
}) => {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8f9fa', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #ddd', backgroundColor: 'white', padding: '15px'}}>
          <h2 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>Вебинар - Студент</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            {student.full_name} | Группа: {student.group} | Сессия ID: {sessionId}
          </p>
          <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '12px' }}>
            Преподаватель: {teacherPresent ? teacherName : 'Не подключен'} |
          </p>
          <button onClick={() => onExit()} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>← Выйти из вебинара</button>
        </div>

        {teacherScreenActive && teacherScreenStream && (
          <div style={{ width: '100%', height: '400px', backgroundColor: '#000', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '12px', backgroundColor: '#080808', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Экран преподавателя: {teacherName}</span>
            </div>
            <video
              ref={teacherVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: 'calc(100% - 40px)', objectFit: 'contain' }}
            />
          </div>
        )}

        {isSharingScreen && localStream && (
          <div style={{ width: '100%', height: '300px', backgroundColor: '#000', overflow: 'hidden', marginBottom: '20px',  }}>
            <div style={{ padding: '12px', backgroundColor: '#fd7e14', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Ваш экран (показывается преподавателю)</span>
            </div>
            <video
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: 'calc(100% - 40px)', objectFit: 'contain' }}
              ref={el => { if (el) el.srcObject = localStream; }}
            />
          </div>
        )}

        <div style={{ padding: '20px', backgroundColor: 'white',  marginBottom: '20px' }}>
          <h4 style={{ color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>Информация о подключении</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa'}}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Статус подключения:</div>
              <div style={{ color: connectionStatus === 'connected' ? '#233327' : '#dc3545', fontWeight: 'bold', fontSize: '14px' }}>
                {connectionStatus === 'connected' ? ' Подключен' : ' Не подключен'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa'}}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Преподаватель:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                {teacherPresent ? ' ' + teacherName : 'Не подключен'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa'}}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Участников:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{participants.length}</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Сообщений:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{messages.length}</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Экран преподавателя:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: teacherScreenActive ? '#0d110e' : '#6c757d' }}>
                {teacherScreenActive ? 'Показывается' : 'Не активен'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa'}}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Ваш экран:</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: isSharingScreen ? '#fd7e14' : '#6c757d' }}>
                {isSharingScreen ? 'Показывается преподавателю' : 'Не активен'}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={() => { trackActivity('need_help'); setNewMessage('Нужна помощь: '); }} style={{ flex: 1, padding: '12px', backgroundColor: '#858583', color: 'black', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>Нужна помощь</button>
          </div>

          {isSharingScreen && (
            <button 
              onClick={stopStudentScreenShare}
              style={{ 
                marginTop: '15px',
                padding: '12px',
                backgroundColor: '#0a0708',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              Остановить трансляцию своего экрана
            </button>
          )}
        </div>
      </div>
      
      <div style={{ width: '400px', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
        <div style={{ padding: '20px',  maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fafafa' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Участники
            <span style={{ backgroundColor: '#6c757d', color: 'white', padding: '2px 8px', fontSize: '12px' }}>{participants.length}</span>
          </h4>
          <div style={{ marginTop: '10px' }}>
            {participants.map((participant) => (
              <div key={`${participant.userType}-${participant.userId}-${participant.socketId}`} style={{ display: 'flex', alignItems: 'center', padding: '10px', marginBottom: '6px'}}>
                <div style={{ width: '8px', height: '8px', marginRight: '12px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{participant.userName}</div>
                  <div style={{ fontSize: '12px', color: '#060505' }}>{participant.userType === 'teacher' ? 'Преподаватель' : 'Студент'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Чат вебинара</h4>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', padding: '15px', backgroundColor: '#f8f9fa', maxHeight: '400px'}}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px', opacity: 0.3 }}></div>
                <p>Сообщений пока нет</p>
                <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>Сообщения видны всем участников вебинара</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={'msg-' + index + '-' + msg.timestamp} style={{ marginBottom: '12px', padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{msg.senderName}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginLeft: 'auto', backgroundColor: '#f8f9fa', padding: '2px 6px' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{msg.text}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Введите сообщение" style={{ flex: 1, padding: '12px' }} />
            <button onClick={sendMessage} disabled={!newMessage.trim() || !socketRef.current?.connected} style={{ padding: '12px 20px', backgroundColor: newMessage.trim() && socketRef.current?.connected ? '#030303' : '#6c757d', color: 'white', fontWeight: 'bold', minWidth: '100px' }}>Отправить</button>
          </div>
        </div>
      </div>

      {incomingScreenRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Запрос на показ экрана</h3>
            <p style={{ marginBottom: '20px' }}>
              Преподаватель просит показать ваш экран.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => startStudentScreenShare(incomingScreenRequest.teacherSocketId)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#040504',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Разрешить
              </button>
              <button
                onClick={() => setIncomingScreenRequest(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebinarStudentView;