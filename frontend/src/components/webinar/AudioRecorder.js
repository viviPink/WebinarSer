import React, { useState, useRef, useEffect } from 'react';
import AudioRecorderView from './AudioRecorderView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:3001';

const AudioRecorder = ({ 
  sessionId, 
  teacherId, 
  teacherName, 
  socketRef,
  onRecordingStarted = () => {},
  onRecordingStopped = () => {},
  onRecordingSaved = () => {},
  onTranscriptionUpdate = () => {}
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingDescription, setRecordingDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showTranscription, setShowTranscription] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const timerRef = useRef(null);
  const audioStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const lastChunkTimeRef = useRef(Date.now());
  const audioChunksForTranscriptionRef = useRef([]);
  const audioContextRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const processorRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Конвертировать Float32Array в WAV
  const floatToWav = (buffer, sampleRate) => {
    const bytesPerSample = 2;
    const format = 1; // PCM
    const channels = 1;
    
    const dataLength = buffer.length * bytesPerSample;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;
    
    const wav = new ArrayBuffer(totalLength);
    const view = new DataView(wav);
    
    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(view, 8, 'WAVE');
    
    // fmt subchunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true); // audio format
    view.setUint16(22, channels, true); // channels
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * channels * bytesPerSample, true); // byte rate
    view.setUint16(32, channels * bytesPerSample, true); // block align
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    
    // data subchunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    floatTo16BitPCM(view, 44, buffer);
    
    return new Blob([wav], { type: 'audio/wav' });
  };
  
  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  const floatTo16BitPCM = (view, offset, input) => {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  };

  // Функция отправки фрагмента на транскрибацию
  const transcribeAudioChunk = async (audioData, sampleRate) => {
    if (!audioData || audioData.length === 0) return;

    try {
      setIsTranscribing(true);
      
      // Конвертируем в WAV
      const wavBlob = floatToWav(audioData, sampleRate);
      
      console.log('Отправка фрагмента, размер:', wavBlob.size, 'байт');
      
      if (wavBlob.size < 2000) {
        console.log('Фрагмент слишком маленький, пропускаем');
        setIsTranscribing(false);
        return;
      }

      const formData = new FormData();
      formData.append('audio', wavBlob, `chunk_${Date.now()}.wav`);

      const response = await fetch(`${API_BASE_URL}/api/audio/transcribe-chunk`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Ошибка транскрибации: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.text && result.text.trim()) {
        console.log('Получен текст:', result.text);
        
        setLiveTranscription(prev => {
          const separator = prev && !prev.endsWith(' ') ? ' ' : '';
          const newText = prev + separator + result.text;
          onTranscriptionUpdate(newText);
          return newText;
        });
      }
    } catch (err) {
      console.error('Ошибка транскрибации фрагмента:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true,
          sampleRate: 16000, // Используем 16kHz для Whisper
          channelCount: 1
        }
      });

      audioStreamRef.current = stream;
      
      // Создаем MediaRecorder для сохранения (в WebM)
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      });

      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        setRecordingDuration(recordingTime);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioChunks([blob]);
        setShowSaveModal(true);
      };

      // Запрашиваем данные каждые 3 секунды
      recorder.start(3000);
      setMediaRecorder(recorder);
      
      // Настраиваем Web Audio API для реального времени
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;
      
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      let audioBuffer = [];
      let lastProcessTime = Date.now();
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);
        
        const now = Date.now();
        if (now - lastProcessTime >= 10000) { // Каждые 10 секунд
          if (audioBuffer.length > 0) {
            const bufferCopy = new Float32Array(audioBuffer);
            transcribeAudioChunk(bufferCopy, audioContext.sampleRate);
            audioBuffer = [];
            lastProcessTime = now;
          }
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setLiveTranscription('');

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

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
      
      // Отключаем процессор
      if (processorRef.current && mediaStreamSourceRef.current) {
        processorRef.current.disconnect();
        mediaStreamSourceRef.current.disconnect();
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
      
      // Подключаем процессор обратно
      if (processorRef.current && mediaStreamSourceRef.current && audioContextRef.current) {
        mediaStreamSourceRef.current.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      
      // Очищаем Web Audio
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      setIsRecording(false);
      setIsPaused(false);

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
      formData.append('transcription', liveTranscription);

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
      setLiveTranscription('');

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
    setLiveTranscription('');
  };

  const undoLastTranscription = () => {
    setLiveTranscription(prev => {
      const sentences = prev.split(/[.!?]+/).filter(s => s.trim());
      sentences.pop();
      const newText = sentences.join('. ') + (sentences.length > 0 ? '.' : '');
      onTranscriptionUpdate(newText);
      return newText;
    });
  };

  const clearTranscription = () => {
    if (window.confirm('Очистить текущий конспект?')) {
      setLiveTranscription('');
      onTranscriptionUpdate('');
    }
  };

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { 
      if (timerRef.current) {
        clearInterval(timerRef.current); 
      }
    };
  }, [isRecording, isPaused]);

  return (
    <AudioRecorderView
      isRecording={isRecording}
      isPaused={isPaused}
      recordingTime={recordingTime}
      showSaveModal={showSaveModal}
      recordingTitle={recordingTitle}
      setRecordingTitle={setRecordingTitle}
      recordingDescription={recordingDescription}
      setRecordingDescription={setRecordingDescription}
      uploading={uploading}
      recordingDuration={recordingDuration}
      formatTime={formatTime}
      startRecording={startRecording}
      pauseRecording={pauseRecording}
      resumeRecording={resumeRecording}
      stopRecording={stopRecording}
      saveRecording={saveRecording}
      cancelRecording={cancelRecording}
      showTranscription={showTranscription}
      setShowTranscription={setShowTranscription}
      liveTranscription={liveTranscription}
      isTranscribing={isTranscribing}
      onUndoLast={undoLastTranscription}
      onClearTranscription={clearTranscription}
    />
  );
};

export default AudioRecorder;