from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import os
import tempfile
import traceback
import time

app = Flask(__name__)
CORS(app, origins=["https://localhost:3001", "https://localhost:3000", "https://localhost:3000"])


try:
    model = whisper.load_model("base")
    print("Модель успешно загружена!")
except Exception as e:
    print(f"Ошибка загрузки модели: {e}")
    model = None

chunk_counter = 0

@app.route('/health', methods=['GET', 'OPTIONS'])
def health_check():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "timestamp": time.time()
    })

@app.route('/transcribe', methods=['POST', 'OPTIONS'])
def transcribe():
    if request.method == 'OPTIONS':
        return '', 200
        
    if model is None:
        return jsonify({"error": "Модель не загружена"}), 500

    if 'audio' not in request.files:
        return jsonify({"error": "Аудиофайл не найден"}), 400

    audio_file = request.files['audio']
    
    # Определяем расширение по content-type
    content_type = audio_file.content_type or ''
    if 'wav' in content_type:
        suffix = '.wav'
    else:
        suffix = '.webm'
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        audio_file.save(tmp.name)
        temp_path = tmp.name

    try:
        file_size = os.path.getsize(temp_path)
        print(f"Транскрибация: {file_size} байт")
        
        result = model.transcribe(temp_path, language="ru", fp16=False)
        text = result["text"].strip()
        print(f"Результат: {text[:50]}...")
        
        return jsonify({"text": text})
    except Exception as e:
        print(f"Ошибка: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass

@app.route('/transcribe-chunk', methods=['POST', 'OPTIONS'])
def transcribe_chunk():
    global chunk_counter
    
    if request.method == 'OPTIONS':
        return '', 200
        
    if model is None:
        return jsonify({"error": "Модель не загружена"}), 500

    if 'audio' not in request.files:
        return jsonify({"error": "Аудиофайл не найден"}), 400

    audio_file = request.files['audio']
    chunk_counter += 1
    
    print(f"\nФРАГМЕНТ #{chunk_counter}")
    print(f"Content-Type: {audio_file.content_type}")
    print(f"Filename: {audio_file.filename}")
    
    # Всегда используем .wav для фрагментов
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        audio_file.save(tmp.name)
        temp_path = tmp.name

    try:
        file_size = os.path.getsize(temp_path)
        print(f"Размер: {file_size} байт")
        
        if file_size < 1000:
            print("Слишком маленький")
            return jsonify({"text": ""})
        
        start = time.time()
        result = model.transcribe(
            temp_path,
            language="ru",
            fp16=False,
            task="transcribe",
            temperature=0,
            without_timestamps=True
        )
        elapsed = time.time() - start
        
        text = result["text"].strip()
        print(f"Готово за {elapsed:.2f}с: '{text}'")
        
        return jsonify({
            "text": text,
            "processing_time": elapsed
        })
        
    except Exception as e:
        print(f"Ошибка: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass

if __name__ == '__main__':
    print("\nhttp://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)