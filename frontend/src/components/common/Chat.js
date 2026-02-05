import React, { useRef, useEffect } from 'react';

const Chat = ({ messages, newMessage, setNewMessage, sendMessage, disabled, placeholder = "Введите сообщение" }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Чат вебинара</h4>
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        marginBottom: '15px', 
        padding: '15px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px', 
        maxHeight: '400px', 
        border: '1px solid #e9ecef' 
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px', opacity: 0.3 }}></div>
            <p>Начните общение в чате</p>
            <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
              Сообщения видны всем участникам вебинара
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={`msg-${index}-${msg.timestamp}`} 
              style={{ 
                marginBottom: '12px', 
                padding: '10px', 
                backgroundColor: msg.senderType === 'teacher' ? '#e7f3ff' : 'white', 
                borderRadius: '8px', 
                borderLeft: `4px solid ${msg.senderType === 'teacher' ? '#007bff' : '#040504'}`, 
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  {msg.senderName}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#666', 
                  marginLeft: 'auto', 
                  backgroundColor: '#f8f9fa', 
                  padding: '2px 6px', 
                  borderRadius: '10px' 
                }}>
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
        <input 
          type="text" 
          value={newMessage} 
          onChange={(e) => setNewMessage(e.target.value)} 
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
          placeholder={placeholder} 
          style={{ 
            flex: 1, 
            padding: '12px', 
            border: '1px solid #ddd', 
            borderRadius: '6px', 
            fontSize: '14px', 
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' 
          }} 
        />
        <button 
          onClick={sendMessage} 
          disabled={disabled}
          style={{ 
            padding: '12px 20px', 
            backgroundColor: disabled ? '#6c757d' : '#030303', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: disabled ? 'not-allowed' : 'pointer', 
            fontWeight: 'bold', 
            minWidth: '100px' 
          }}
        >
          Отправить
        </button>
      </div>
    </>
  );
};

export default Chat;