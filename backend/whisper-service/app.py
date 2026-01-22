from flask import Flask, request, jsonify
import whisper
import os
import tempfile
import traceback

app = Flask(__name__)
from flask_cors import CORS
CORS(app)

print("Загрузка модели Whisper...")
try:
    model = whisper.load_model("base")
    print("Модель успешно загружена!")
except Exception as e:
    print(f"Ошибка загрузки модели: {e}")
    model = None

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "message": "Whisper-сервис готов к работе" if model else "Модель не загружена"
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if model is None:
        return jsonify({"error": "Модель Whisper не загружена"}), 500

    if 'audio' not in request.files:
        return jsonify({"error": "Аудиофайл не найден в запросе"}), 400

    audio_file = request.files['audio']
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        audio_file.save(tmp.name)
        temp_path = tmp.name

    try:
        result = model.transcribe(temp_path, language="ru", fp16=False)
        return jsonify({"text": result["text"].strip()})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == '__main__':
    print("Запуск Whisper-сервиса на http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)