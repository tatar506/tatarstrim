const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Разрешаем всё для теста
        methods: ["GET", "POST"]
    },
    allowEIO3: true // Для совместимости
});
const { ExpressPeerServer } = require('peer');

const PORT = process.env.PORT || 3000;
const MASTER_PASS = "tatar_super_pass"; 

let users = []; 
let activeStreamers = [];

app.use(express.static('public'));

// PeerServer настройки
const peerServer = ExpressPeerServer(http, {
    debug: true,
    path: '/',
    allow_discovery: true
});
app.use('/peerjs', peerServer);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Регистрация (БЕЗ ПРОВЕРКИ СЛОЖНОСТИ)
    socket.on('register-account', (data) => {
        if (users.find(u => u.username === data.username)) {
            return socket.emit('auth-error', 'Ник занят');
        }
        users.push({ username: data.username, password: data.password });
        socket.emit('auth-success', { username: data.username });
    });

    socket.on('login-account', (data) => {
        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) socket.emit('auth-success', { username: user.username });
        else socket.emit('auth-error', 'Ошибка входа');
    });

    socket.emit('update-stream-list', activeStreamers);

    socket.on('start-stream-request', (pass) => {
        if (pass === MASTER_PASS) socket.emit('stream-auth-ok');
        else socket.emit('stream-auth-fail');
    });

    socket.on('stream-started', (data) => {
        activeStreamers = activeStreamers.filter(s => s.socketId !== socket.id);
        activeStreamers.push({ ...data, socketId: socket.id });
        io.emit('update-stream-list', activeStreamers);
    });

    socket.on('chat-message', (data) => io.emit('chat-message', data));
    socket.on('send-donation', (data) => io.emit('alert', { type: 'donation', ...data }));
    socket.on('send-sub', (data) => io.emit('alert', { type: 'sub', ...data }));

    socket.on('disconnect', () => {
        activeStreamers = activeStreamers.filter(s => s.socketId !== socket.id);
        io.emit('update-stream-list', activeStreamers);
    });
});

http.listen(PORT, () => console.log(`Server is Live on port ${PORT}`));
