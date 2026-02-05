import React, { useState, useEffect, useRef } from 'react';

const TranscriptionModal = ({ recordingId, onClose, onSave }) => {
  const [transcription, setTranscription] = useState('');
  const [originalTranscription, setOriginalTranscription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordingInfo, setRecordingInfo] = useState(null);
  const [error, setError] = useState('');
  const [changesMade, setChangesMade] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const textareaRef = useRef(null);
  const audioRef = useRef(null);
  
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Получить данные записи и транскрипцию
  useEffect(() => {
    if (!recordingId) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(`${API_BASE_URL}/api/audio/${recordingId}/transcription/edit`);
        if (!response.ok) throw new Error('Не удалось загрузить транскрипцию');
        
        const data = await response.json();
        
        setRecordingInfo(data);
        
        const text = data.transcription || '';
        setTranscription(text);
        setOriginalTranscription(text);
        updateCounts(text);
        
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [recordingId]);

  // Обновляем счетчики
  const updateCounts = (text) => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
    setCharCount(text.length);
  };

  const handleTranscriptionChange = (e) => {
    const newText = e.target.value;
    setTranscription(newText);
    updateCounts(newText);
    setChangesMade(newText !== originalTranscription);
  };

  const handleSave = async () => {
    if (!transcription.trim() && !window.confirm('Сохранить пустую транскрипцию?')) {
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/api/audio/${recordingId}/transcription/edit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcription: transcription.trim() })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось сохранить транскрипцию');
      }
      
      const result = await response.json();
      setOriginalTranscription(transcription.trim());
      setChangesMade(false);
      
      // Вызываем callback для обновления родительского компонента
      if (onSave) {
        onSave(recordingId, transcription.trim());
      }
      
      alert(result.message || 'Транскрипция успешно сохранена!');
      
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      setError(err.message || 'Ошибка сохранения транскрипции');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (changesMade && !window.confirm('Есть несохраненные изменения. Выйти без сохранения?')) {
      return;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (onClose) onClose();
  };

  const playAudio = () => {
    if (!recordingInfo?.filePath) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(`${API_BASE_URL}${recordingInfo.filePath}`);
      
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onpause = () => setIsPlaying(false);
      audioRef.current.onplay = () => setIsPlaying(true);
    }
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Ошибка воспроизведения:', err);
        alert('Не удалось воспроизвести аудио');
      });
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '8px',
          textAlign: 'center',
          minWidth: '300px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#333', margin: 0 }}>Загрузка конспекта...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        width: '100%',
        maxWidth: '1200px',
        height: '90vh',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        {/* Шапка модального окна */}
        <div style={{
          padding: '20px',
          backgroundColor: '#343a40',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px'}}>Редактор конспекта</h2>
            <div style={{ fontSize: '14px'}}>
              {recordingInfo?.title || 'Без названия'} {recordingId}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {recordingInfo?.filePath && (
              <button
                onClick={playAudio}
                style={{
                  padding: '8px 16px',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 'bold'
                }}
              >
                
              </button>
            )}
            
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 20px',
                backgroundColor: '#090b0d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            >
              Закрыть
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving || (!changesMade && transcription === originalTranscription)}
              style={{
                padding: '8px 20px',
                backgroundColor: (saving || (!changesMade && transcription === originalTranscription)) ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (saving || (!changesMade && transcription === originalTranscription)) ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                minWidth: '120px'
              }}
            >
              {saving ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    marginRight: '8px',
                    animation: 'spin 1s linear infinite',
                    verticalAlign: 'middle'
                  }}></span>
                  Сохранение
                </>
              ) : 'Сохранить'}
            </button>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          flex: 1,
        }}>
          {/* Основное текстовое поле */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Текстовое поле */}
            <div style={{
              flex: 1,
              overflow: 'hidden',
              position: 'relative'
            }}>
              <textarea
                ref={textareaRef}
                value={transcription}
                onChange={handleTranscriptionChange}
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '25px',
                  border: 'none',
                  fontSize: '16px',
                  lineHeight: '1.7',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#fdfdfd'
                }}
                spellCheck="true"
                autoFocus
              />
              
              {transcription === '' && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: '#adb5bd',
                  pointerEvents: 'none',
                  maxWidth: '400px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px', opacity: 0.3 }}></div>
                  <p style={{ fontSize: '18px', marginBottom: '5px' }}>Текст конспекта отсутствует</p>
                  <p style={{ fontSize: '14px' }}>Начните редактирование или используйте кнопку "Распознать" в основном интерфейсе</p>
                </div>
              )}
            </div>
            
            {/* Состояние ошибки */}
            {error && (
              <div style={{
                padding: '12px 20px',
                backgroundColor: '#f8d7da',
                color: '#721c24',
                borderTop: '1px solid #f5c6cb',
                fontSize: '14px',
                flexShrink: 0
              }}>
                <strong>Ошибка:</strong> {error}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TranscriptionModal;