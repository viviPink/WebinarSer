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
           
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={`msg-${index}-${msg.timestamp}`} 
              style={{ 
                marginBottom: '12px', 
                padding: '10px', 
                backgroundColor: 'white', 
                
              
                
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
           
            fontSize: '14px', 
           
          }} 
        />
        <button 
          onClick={sendMessage} 
          disabled={disabled}
          style={{ 
            padding: '12px 20px', 
            backgroundColor: '#030303', 
            color: 'white', 
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