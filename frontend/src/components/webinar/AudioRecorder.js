import React, { useState, useRef, useEffect } from 'react';

const AudioRecorder = ({ 
  sessionId, 
  teacherId, 
  teacherName, 
  socketRef,
  onRecordingStarted = () => {},
  onRecordingStopped = () => {},
  onRecordingSaved = () => {}
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingDescription, setRecordingDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const timerRef = useRef(null);
  const audioStreamRef = useRef(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      });

      audioStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        setRecordingDuration(recordingTime);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioChunks([blob]);
        setShowSaveModal(true);
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      if (socketRef.current?.connected) {
        socketRef.current.emit('start_recording', {
          sessionId,
          teacherId,
          teacherName
        });
      }

      onRecordingStarted();
    } catch (err) {
      console.error('Ошибка начала записи:', err);
      alert('Не удалось получить доступ к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit('stop_recording', {
          sessionId,
          teacherId,
          teacherName
        });
      }

      onRecordingStopped();
    }
  };

  const saveRecording = async () => {
    if (audioChunks.length === 0) {
      alert('Нет данных для сохранения');
      return;
    }

    setUploading(true);
    try {
      const blob = audioChunks[0];
      const formData = new FormData();
      formData.append('audio', blob, `recording_${sessionId}.webm`);
      formData.append('sessionId', sessionId);
      formData.append('teacherId', teacherId);
      formData.append('title', recordingTitle || `Запись от ${new Date().toLocaleString()}`);
      formData.append('description', recordingDescription);
      formData.append('duration', recordingDuration);

      const response = await fetch(`${API_BASE_URL}/api/audio/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Ошибка загрузки файла');

      const result = await response.json();

      setShowSaveModal(false);
      setRecordingTitle('');
      setRecordingDescription('');
      setAudioChunks([]);
      setRecordingTime(0);
      setRecordingDuration(0);

      onRecordingSaved(result);
      
      alert('Запись успешно сохранена');
    } catch (err) {
      console.error('Ошибка сохранения записи:', err);
      alert('Ошибка сохранения записи: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const cancelRecording = () => {
    setShowSaveModal(false);
    setRecordingTitle('');
    setRecordingDescription('');
    setAudioChunks([]);
    setRecordingTime(0);
    setRecordingDuration(0);
  };

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  return (
    <>
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        padding: '20px', 
        marginBottom: '20px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
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
                backgroundColor: '#dc3545', 
                borderRadius: '6px', 
                color: 'white' 
              }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: 'white', 
                  borderRadius: '50%', 
                  animation: 'pulse 1s infinite' 
                }}></div>
                <span>Идет запись</span>
                <span style={{ fontWeight: 'bold' }}>{formatTime(recordingTime)}</span>
              </div>
              <button 
                onClick={stopRecording}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: '#6c757d', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold' 
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
                backgroundColor: '#28a745', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
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
            borderRadius: '10px', 
            width: '500px', 
            maxWidth: '90%', 
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)' 
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
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  fontSize: '14px' 
                }} 
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                Описание (необязательно):
              </label>
              <textarea 
                value={recordingDescription} 
                onChange={(e) => setRecordingDescription(e.target.value)} 
                placeholder="Введите описание записи" 
                rows="3" 
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
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
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: uploading ? 'not-allowed' : 'pointer' 
                }}
              >
                Отмена
              </button>
              <button 
                onClick={saveRecording} 
                disabled={uploading || !recordingTitle.trim()}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: uploading || !recordingTitle.trim() ? '#6c757d' : '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: uploading || !recordingTitle.trim() ? 'not-allowed' : 'pointer' 
                }}
              >
                {uploading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AudioRecorder;