const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { ExpressPeerServer } = require('peer');

const PORT = process.env.PORT || 3000;

// Пароль для стримера (измени его!)
const STREAMER_PASSWORD = "tatar_super_pass"; 

app.use(express.static('public'));

const peerServer = ExpressPeerServer(http, {
    debug: true,
    path: '/myapp'
});

app.use('/peerjs', peerServer);

let users = [];

io.on('connection', (socket) => {
    console.log('Пользователь подключился');

    socket.on('register', (data) => {
        users.push({ id: socket.id, username: data.username });
        socket.emit('registered', { success: true });
    });

    socket.on('chat-message', (data) => {
        io.emit('chat-message', data);
    });

    // Проверка пароля для начала стрима
    socket.on('start-stream-request', (pass) => {
        if (pass === STREAMER_PASSWORD) {
            socket.emit('stream-auth-success');
        } else {
            socket.emit('stream-auth-fail');
        }
    });

    // Эмуляция донатов (команда в чате для теста: /donate 100)
    socket.on('send-donation', (data) => {
        io.emit('new-donation', data);
    });
});

http.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});