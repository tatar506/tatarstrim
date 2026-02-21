const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: ["https://tatar506.github.io", "https://tatarstrim.onrender.com"],
        methods: ["GET", "POST"],
        credentials: true
    }
});
const { ExpressPeerServer } = require('peer');

const PORT = process.env.PORT || 3000;
const MASTER_STREAM_PASS = "tatar_super_pass"; // Пароль, чтобы стать стримером

let users = []; // {username, password}
let activeStreamers = [];

app.use(express.static('public'));

// PeerServer с исправленным CORS
const peerServer = ExpressPeerServer(http, {
    debug: true,
    path: '/',
    proxied: true
});
app.use('/peerjs', peerServer);

io.on('connection', (socket) => {
    // Регистрация
    socket.on('register-account', (data) => {
        const { username, password } = data;
        if (users.find(u => u.username === username)) {
            return socket.emit('auth-error', 'Этот ник уже занят!');
        }
        users.push({ username, password });
        socket.emit('auth-success', { username });
    });

    // Логин
    socket.on('login-account', (data) => {
        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) {
            socket.emit('auth-success', { username: user.username });
        } else {
            socket.emit('auth-error', 'Неверный ник или пароль!');
        }
    });

    socket.emit('update-stream-list', activeStreamers);

    socket.on('start-stream-request', (pass) => {
        if (pass === MASTER_STREAM_PASS) socket.emit('stream-auth-ok');
        else socket.emit('stream-auth-fail');
    });

    socket.on('stream-started', (data) => {
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

http.listen(PORT, () => console.log(`Server running on ${PORT}`));
