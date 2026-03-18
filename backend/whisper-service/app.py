from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import os
import tempfile
import traceback
import time
import sys
import requests

app = Flask(__name__)
CORS(app, origins=["https://192.168.0.17:3001", "https://192.168.0.17:3000", "https://192.168.0.17:3001", "https://192.168.0.17:3000"])


# Конфигурация для LM Studio
LM_STUDIO_URL = "http://192.168.56.1:1234"  # Адрес LM Studio
LM_STUDIO_MODEL = "qwen2.5-7b-instruct-1m"  

# Проверка наличия ffmpeg 
import subprocess
try:
    subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    print("[OK] ffmpeg найден")
except:
    print("[ERROR] ffmpeg не найден! Whisper может не работать")
    print("Установите ffmpeg: sudo apt-get install ffmpeg")

print("Загрузка модели Whisper...")
sys.stdout.flush()

try:
    # Загружаем модель
    model = whisper.load_model("base")
    print("[OK] Модель Whisper (base) успешно загружена!")
except Exception as e:
    print(f"[ERROR] Ошибка загрузки модели: {e}")
    traceback.print_exc()
    model = None

chunk_counter = 0
total_chunks_processed = 0

print("="*60 + "\n")

@app.route('/health', methods=['GET', 'OPTIONS'])
def health_check():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "message": "Whisper-сервис готов к работе" if model else "Модель не загружена",
        "supports_timings": True,
        "supports_realtime": True,
        "chunks_processed": total_chunks_processed
    })

@app.route('/transcribe', methods=['POST', 'OPTIONS'])
def transcribe():
    if request.method == 'OPTIONS':
        return '', 200
        
    if model is None:
        return jsonify({"error": "Модель Whisper не загружена"}), 500

    if 'audio' not in request.files:
        print("[ERROR] Аудиофайл не найден в запросе")
        return jsonify({"error": "Аудиофайл не найден в запросе"}), 400

    audio_file = request.files['audio']
    return_timings = request.form.get('return_timings', 'false').lower() == 'true'
    
    print(f"\n[TRANSCRIBE] ПОЛНАЯ ТРАНСКРИБАЦИЯ")
    print(f"   Файл: {audio_file.filename}")
    print(f"   Content-Type: {audio_file.content_type}")
    print(f"   return_timings: {return_timings}")
    
    # Сохраняем временный файл
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp:
        audio_file.save(tmp.name)
        temp_path = tmp.name
        print(f"   Временный файл: {temp_path}")

    try:
        file_size = os.path.getsize(temp_path)
        print(f"   Размер: {file_size} байт")
        
        if file_size < 1000:
            print("   [WARN] Файл слишком маленький")
            return jsonify({"text": ""})
        
        start_time = time.time()
        
        # Транскрибация
        result = model.transcribe(
            temp_path,
            language="ru",
            fp16=False,
            word_timestamps=return_timings
        )
        
        text = result["text"].strip()
        elapsed = time.time() - start_time
        
        print(f"   [OK] Готово за {elapsed:.2f}с")
        print(f"   Текст: {text[:100]}..." + (" (пусто)" if not text else ""))
        
        response = {
            "text": text,
            "processing_time": elapsed
        }
        
        if return_timings and "segments" in result:
            timings = []
            for segment in result["segments"]:
                if "words" in segment:
                    for word in segment["words"]:
                        timings.append({
                            "word": word["word"].strip(),
                            "start": word["start"],
                            "end": word["end"]
                        })
            response["timings"] = timings
            print(f"   Получено таймингов: {len(timings)}")
        
        return jsonify(response)
        
    except Exception as e:
        print(f"[ERROR] Ошибка: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            print(f"   Временный файл удален")

@app.route('/transcribe-chunk', methods=['POST', 'OPTIONS'])
def transcribe_chunk():
    global chunk_counter, total_chunks_processed
    
    if request.method == 'OPTIONS':
        return '', 200
        
    if model is None:
        return jsonify({"error": "Модель Whisper не загружена"}), 500

    if 'audio' not in request.files:
        print("[ERROR] Аудиофайл не найден в запросе")
        return jsonify({"error": "Аудиофайл не найден в запросе"}), 400

    audio_file = request.files['audio']
    return_timings = request.form.get('return_timings', 'false').lower() == 'true'
    chunk_counter += 1
    total_chunks_processed += 1
    
    print(f"\n[CHUNK] ФРАГМЕНТ #{chunk_counter} (РЕАЛЬНОЕ ВРЕМЯ)")
    print(f"   Время: {time.strftime('%H:%M:%S')}")
    print(f"   Content-Type: {audio_file.content_type}")
    print(f"   Filename: {audio_file.filename}")
    print(f"   return_timings: {return_timings}")
    
    # Проверяем, есть ли данные в файле
    if not audio_file or audio_file.filename == '':
        print("   [WARN] Пустой файл, пропускаем")
        return jsonify({"text": ""})
    
    # Сохраняем временный файл
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        audio_file.save(tmp.name)
        temp_path = tmp.name
        print(f"   Временный файл: {temp_path}")

    try:
        file_size = os.path.getsize(temp_path)
        print(f"   Размер: {file_size} байт")
        
        if file_size < 1000:  # Меньше 1KB - слишком маленький фрагмент
            print("   [WARN] Фрагмент слишком маленький")
            return jsonify({"text": ""})
        
        start_time = time.time()
        
        # Транскрибация фрагмента
        result = model.transcribe(
            temp_path,
            language="ru",
            fp16=False,
            task="transcribe",
            temperature=0,
            word_timestamps=return_timings,
            condition_on_previous_text=False,
            verbose=False
        )
        
        text = result["text"].strip()
        elapsed = time.time() - start_time
        
        print(f"   Распознано за {elapsed:.2f}с")
        print(f"   Текст: '{text}'")
        
        response = {
            "text": text,
            "processing_time": elapsed,
            "chunk_id": chunk_counter
        }
        
        if return_timings and "segments" in result:
            timings = []
            for segment in result["segments"]:
                if "words" in segment:
                    for word in segment["words"]:
                        timings.append({
                            "word": word["word"].strip(),
                            "start": word["start"],
                            "end": word["end"]
                        })
            response["timings"] = timings
            print(f"   Таймингов: {len(timings)}")
        
        return jsonify(response)
        
    except Exception as e:
        print(f"[ERROR] Ошибка обработки фрагмента: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            print(f"   Временный файл удален")

# ========== ЭНДПОИНТЫ ДЛЯ LM STUDIO ==========

@app.route('/summarize', methods=['POST', 'OPTIONS'])
def summarize_text():
    """Создает структурированный конспект из текста через LM Studio"""
    if request.method == 'OPTIONS':
        return '', 200
    
    data = request.json
    text = data.get('text', '')
    action = data.get('action', 'summary')  # summary, bullet_points, structure, questions
    
    if not text:
        return jsonify({"error": "Текст не предоставлен"}), 400
    
    print(f"\n[SUMMARIZE] СОЗДАНИЕ КОНСПЕКТА")
    print(f"   Длина текста: {len(text)} символов")
    print(f"   Действие: {action}")
    
    # Разные промпты для разных действий
    prompts = {
        'summary': f"""Составь краткий структурированный конспект на русском языке по следующему тексту. 
Выдели основные тезисы, ключевые идеи и важные детали.
Используй заголовки и списки для лучшей структуры.

Текст:
{text}

Конспект:""",

        'bullet_points': f"""Преобразуй следующий текст в список основных тезисов на русском языке.
Каждый тезис начинай с новой строки.
Выдели только самое важное, без воды.

Текст:
{text}

Тезисы:""",

        'structure': f"""Проанализируй следующий текст и создай его структуру с заголовками и подзаголовками на русском языке.
Используй формат:
Главная тема
Подтема 1
- Ключевой пункт
Подтема 2
- Ключевой пункт

Текст:
{text}

Структура:""",

        'questions': f"""На основе текста составь 5-10 вопросов для проверки понимания материала.
Вопросы должны быть на русском языке и охватывать основные идеи текста.

Текст:
{text}

Вопросы:"""
    }
    
    prompt = prompts.get(action, prompts['summary'])
    
    try:
        # Полный URL эндпоинта
        api_url = f"{LM_STUDIO_URL}/v1/chat/completions"
        
        # Правильный формат запроса (OpenAI-style)
        payload = {
            "model": LM_STUDIO_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,
            "max_tokens": 2048
        }
        
        start_time = time.time()
        
        print(f"   [API] Отправка запроса к {api_url}")
        response = requests.post(api_url, json=payload, timeout=120)
        
        if response.status_code == 200:
            result = response.json()
            
            # Правильное извлечение ответа
            if 'choices' in result and len(result['choices']) > 0:
                summary = result['choices'][0]['message']['content'].strip()
                
                elapsed = time.time() - start_time
                print(f"   [OK] Конспект готов за {elapsed:.2f}с")
                print(f"   Длина конспекта: {len(summary)} символов")
                
                return jsonify({
                    "success": True,
                    "summary": summary,
                    "action": action,
                    "processing_time": elapsed
                })
            else:
                print(f"   [ERROR] Неожиданный формат ответа: {result}")
                return jsonify({"error": "Неожиданный формат ответа от LM Studio"}), 500
        else:
            print(f"   [ERROR] Ошибка LM Studio: {response.status_code} - {response.text}")
            return jsonify({"error": f"Ошибка LM Studio: {response.status_code}"}), 500
            
    except requests.exceptions.ConnectionError:
        print("   [ERROR] Ошибка подключения к LM Studio")
        return jsonify({"error": "LM Studio не запущена или недоступна"}), 503
    except Exception as e:
        print(f"   [ERROR] Ошибка: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/summarize/status', methods=['GET', 'OPTIONS'])
def summarize_status():
    """Проверяет доступность LM Studio"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Используем правильный IP и эндпоинт
        response = requests.get(f"{LM_STUDIO_URL}/v1/models", timeout=2)
        if response.status_code == 200:
            return jsonify({
                "available": True,
                "model": LM_STUDIO_MODEL,
                "message": "LM Studio доступна"
            })
        else:
            return jsonify({
                "available": False,
                "message": f"LM Studio отвечает с ошибкой: {response.status_code}"
            })
    except requests.exceptions.ConnectionError:
        return jsonify({
            "available": False,
            "message": "LM Studio не запущена или недоступна"
        })
    except Exception as e:
        return jsonify({
            "available": False,
            "message": f"Ошибка проверки: {str(e)}"
        })

if __name__ == '__main__':
    
    print("WHISPER СЕРВЕР ЗАПУЩЕН")
    
    print("Эндпоинты:")
    print("   • POST /transcribe        - полная транскрибация")
    print("   • POST /transcribe-chunk  - фрагменты (реальное время)")
    print("   • POST /summarize         - создание конспекта через LM Studio")
    print("   • GET  /summarize/status  - проверка статуса LM Studio")
    print("   • GET  /health            - проверка статуса")
    print("\nПараметры:")
    print("   • Модель Whisper: base")
    print("   • LM Studio модель: qwen2.5-7b-instruct-1m")
    print("   • LM Studio URL: " + LM_STUDIO_URL)
    print("   • Реальное время: ДА (каждые 10 сек)")
    print("   • Тайминги слов: ДА")
    print("   • Язык: русский")
    print("\nСервер доступен по адресу: http://localhost:5000")
    print("="*60 + "\n")
    
    # Принудительно сбрасываем буфер вывода
    sys.stdout.flush()
    
    # Запускаем сервер
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)