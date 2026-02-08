# WebinarSer
Система для проведения онлайн-вебинаров с возможностью записи аудио, автоматической транскрипцией речи и демонстрацией экрана. Включает роли преподавателя и студента.

Установка зависимостей

1. Бэкенд (Node.js)
npm install
Зависимости сервера: express, socket.io, pg (PostgreSQL), multer (загрузка файлов), cors, axios, uuid

2. Фронтенд (React)
npm install
Зависимости клиента: react, socket.io-client 

3. Whisper сервис (Python)
pip install flask flask-cors openai-whisper torch


Настройка окружения
1. Создайте файл .env в корне проекта:


PORT=3001
NODE_ENV=development

# База данных PostgreSQL
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=webinar_platform

# Whisper сервис
WHISPER_SERVICE_URL=http://localhost:5000

# React 
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001

Запуск
1. Запустите Whisper сервис
python whisper_service.py
2. Запустите основной сервер
node server.js
3. Запустите React приложение 
npm start



ПРОДОЛЖЕНИЕ СЛЕДУЕТ...........
