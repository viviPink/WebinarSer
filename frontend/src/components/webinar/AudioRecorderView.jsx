import React from 'react';

const AudioRecorderView = ({
  isRecording,
  recordingTime,
  showSaveModal,
  recordingTitle,
  setRecordingTitle,
  recordingDescription,
  setRecordingDescription,
  uploading,
  recordingDuration,
  formatTime,
  startRecording,
  stopRecording,
  saveRecording,
  cancelRecording
}) => {
  return (
    <>
      <div style={{ 
        backgroundColor: 'white', 
        
        padding: '20px', 
        marginBottom: '20px', 
        
      }}>
        <h4 style={{ color: '#333', marginBottom: '15px' }}>Запись аудио</h4>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {isRecording ? (
            <>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                padding: '10px', 
                backgroundColor: '#0b0708', 
                
                color: 'white' 
              }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: 'white', 
                  
                }}></div>
                <span>Идет запись</span>
                <span style={{ fontWeight: 'bold' }}>{formatTime(recordingTime)}</span>
              </div>
              <button 
                onClick={stopRecording}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: '#6c757d', 
                  color: 'white'
                }}
              >
                Остановить запись
              </button>
            </>
          ) : (
            <button 
              onClick={startRecording} 
              disabled={!navigator.mediaDevices?.getUserMedia}
              style={{ 
                padding: '12px 24px', 
                color: 'white', 
                fontWeight: 'bold', 
                fontSize: '16px' 
              }}
            >
              Начать запись голоса
            </button>
          )}
        </div>

        <style>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>

      {/* Модальное окно сохранения записи */}
      {showSaveModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px', 
            
            width: '500px', 
            maxWidth: '90%', 
            
          }}>
            <h3 style={{ marginTop: 0, color: '#333', marginBottom: '20px' }}>Сохранить аудиозапись</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                Название записи:
              </label>
              <input 
                type="text" 
                value={recordingTitle} 
                onChange={(e) => setRecordingTitle(e.target.value)} 
                placeholder="Введите название записи" 
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  fontSize: '14px' 
                }} 
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                Описание:
              </label>
              <textarea 
                value={recordingDescription} 
                onChange={(e) => setRecordingDescription(e.target.value)} 
                placeholder="Введите описание записи" 
                rows="3" 
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  fontSize: '14px', 
                  resize: 'vertical' 
                }} 
              />
            </div>
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '14px', color: '#666' }}><strong>Информация о записи:</strong></div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                Длительность: {formatTime(recordingDuration)}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={cancelRecording} 
                disabled={uploading}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: '#6c757d', 
                  color: 'white'
                }}
              >
                Отмена
              </button>
              <button 
                onClick={saveRecording} 
                disabled={uploading || !recordingTitle.trim()}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: '#e5e5e5', 
                  color: 'white'
                }}
              >
                {uploading ? 'Сохранение' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AudioRecorderView;