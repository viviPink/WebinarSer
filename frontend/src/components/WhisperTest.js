import React, { useState } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const WhisperTest = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedExtensions = ['.webm', '.wav', '.mp3', '.ogg'];
      const fileName = file.name.toLowerCase();
      const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));

      if (!isValid) {
        setError('Поддерживаются только аудиофайлы: .webm, .wav, .mp3, .ogg');
        setAudioFile(null);
        return;
      }

      setAudioFile(file);
      setTranscription('');
      setError('');
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) {
      setError('Пожалуйста, выберите аудиофайл');
      return;
    }

    const formData = new FormData();
    formData.append('audio', audioFile);

    setIsTranscribing(true);
    setError('');
    setTranscription('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/whisper/transcribe`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.text) {
        setTranscription(result.text);
      } else {
        setError(result.error || 'Неизвестная ошибка транскрибирования');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      setError('Не удалось подключиться к сервису транскрибирования');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>🎤 Тест транскрибирования Whisper</h2>
      <p>Загрузите аудиофайл и получите текст речи</p>

      <div style={{ marginTop: '20px' }}>
        <input type="file" accept=".webm,.wav,.mp3,.ogg,audio/*" onChange={handleFileChange} />
      </div>

      {audioFile && (
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          Выбран файл: <strong>{audioFile.name}</strong> ({(audioFile.size / 1024).toFixed(1)} KB)
        </div>
      )}

      <button
        onClick={handleTranscribe}
        disabled={!audioFile || isTranscribing}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: (!audioFile || isTranscribing) ? '#6c757d' : '#17a2b8',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: (!audioFile || isTranscribing) ? 'not-allowed' : 'pointer',
        }}
      >
        {isTranscribing ? 'Распознавание...' : '📝 Распознать речь'}
      </button>

      {error && (
        <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
          ❌ {error}
        </div>
      )}

      {transcription && (
        <div style={{ marginTop: '20px' }}>
          <h3>Результат:</h3>
          <div style={{ padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
            {transcription}
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', fontSize: '12px', color: '#999' }}>
        <p>ℹ️ Поддерживаемые форматы: <code>.webm</code>, <code>.wav</code>, <code>.mp3</code>, <code>.ogg</code></p>
        <p>ℹ️ Убедитесь, что запущены:</p>
        <ul>
          <li>Бэкенд: <code>npm run dev</code> → порт 3001</li>
          <li>Whisper: <code>python app.py</code> → порт 5000</li>
        </ul>
      </div>
    </div>
  );
};

export default WhisperTest;