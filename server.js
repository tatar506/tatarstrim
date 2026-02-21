const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Разрешаем подключения со всех адресов (важно для GitHub/Render)
        methods: ["GET", "POST"]
    }
});
const { ExpressPeerServer } = require('peer');

const PORT = process.env.PORT || 3000;

// Твой секретный пароль для стримеров
const STREAMER_PASSWORD = "tatar_super_pass"; 

// Список активных трансляций
let activeStreamers = [];

app.use(express.static('public'));

// Настройка PeerJS (сервер для видео-сигналов)
const peerServer = ExpressPeerServer(http, {
    debug: true,
    path: '/'
});
app.use('/peerjs', peerServer);

// Работа с сокетами (чат, уведомления, список стримов)
io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // При входе отправляем пользователю список тех, кто уже стримит
    socket.emit('update-stream-list', activeStreamers);

    // Проверка пароля для начала стрима
    socket.on('start-stream-request', (pass) => {
        if (pass === STREAMER_PASSWORD) {
            socket.emit('stream-auth-success');
        } else {
            socket.emit('stream-auth-fail');
        }
    });

    // Когда кто-то успешно запустил стрим
    socket.on('stream-started', (data) => {
        // Проверяем, нет ли его уже в списке (чтобы не дублировать)
        activeStreamers = activeStreamers.filter(s => s.socketId !== socket.id);
        
        // Добавляем стримера: его PeerID (для видео) и Nickname (для красоты)
        activeStreamers.push({
            peerId: data.peerId,
            user: data.user,
            socketId: socket.id
        });

        console.log(`Стрим запущен пользователем: ${data.user}`);
        // Рассылаем всем обновленный список стримов
        io.emit('update-stream-list', activeStreamers);
    });

    // Чат сообщения
    socket.on('chat-message', (data) => {
        io.emit('chat-message', data);
    });

    // Донаты
    socket.on('send-donation', (data) => {
        io.emit('new-donation', data);
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        const index = activeStreamers.findIndex(s => s.socketId === socket.id);
        if (index !== -1) {
            console.log(`Стример ${activeStreamers[index].user} отключился`);
            activeStreamers.splice(index, 1);
            // Уведомляем всех, что стрим закончился
            io.emit('update-stream-list', activeStreamers);
        }
        console.log('Пользователь ушел');
    });
});

// Запуск сервера
http.listen(PORT, () => {
    console.log(`
    ======================================
    Платформа TATARSTRIM запущена!
    Порт: ${PORT}
    Пароль для стрима: ${STREAMER_PASSWORD}
    ======================================
    `);
});
