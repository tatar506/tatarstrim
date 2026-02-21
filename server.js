const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Позволяет подключаться с любого адреса
        methods: ["GET", "POST"]
    }
});
const { ExpressPeerServer } = require('peer');

const PORT = process.env.PORT || 3000;

// Твой секретный пароль для запуска стрима
const STREAMER_PASSWORD = "tatar_super_pass"; 

// Переменная для хранения ID текущего стримера
let currentStreamerPeerId = null;

// Настройка папки со статикой (твой фронтенд)
app.use(express.static('public'));

// Настройка PeerJS сервера (для видеосвязи)
const peerServer = ExpressPeerServer(http, {
    debug: true,
    path: '/'
});
app.use('/peerjs', peerServer);

// Логика Socket.io
io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    // Если стрим уже идет, сразу сообщаем новому пользователю ID стримера
    if (currentStreamerPeerId) {
        socket.emit('stream-available', currentStreamerPeerId);
    }

    // Регистрация пользователя (ник)
    socket.on('register', (data) => {
        console.log(`Пользователь ${data.username} вошел в сеть`);
    });

    // Проверка пароля стримера
    socket.on('start-stream-request', (pass) => {
        if (pass === STREAMER_PASSWORD) {
            socket.emit('stream-auth-success');
        } else {
            socket.emit('stream-auth-fail');
        }
    });

    // Когда стример начал трансляцию, сохраняем его Peer ID и рассылаем всем
    socket.on('stream-started', (data) => {
        currentStreamerPeerId = data.peerId;
        // Отправляем всем, кроме самого стримера
        socket.broadcast.emit('stream-available', data.peerId);
        console.log('Стрим запущен стримером с PeerID:', data.peerId);
    });

    // Чат сообщения
    socket.on('chat-message', (data) => {
        io.emit('chat-message', data); // Рассылаем всем
    });

    // Донаты
    socket.on('send-donation', (data) => {
        io.emit('new-donation', data); // Рассылаем всем
    });

    // Когда кто-то отключается
    socket.on('disconnect', () => {
        // Если отключился стример, обнуляем ID
        // (Для упрощения: если сокет стримера закрыт, ID можно сбросить)
        console.log('Пользователь ушел:', socket.id);
    });
});

// Запуск сервера
http.listen(PORT, () => {
    console.log(`=== TATARSTRIM ЗАПУЩЕН ===`);
    console.log(`Порт: ${PORT}`);
    console.log(`Пароль для стрима: ${STREAMER_PASSWORD}`);
});
