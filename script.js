const socket = io();
let myPeer;
let username = "";
let currentPeerId = "";

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

function register() {
    username = document.getElementById('username').value;
    if (username) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        
        // Инициализируем PeerJS
        myPeer = new Peer(undefined, {
            path: '/peerjs',
            host: '/',
            port: location.port || (location.protocol === 'https:' ? 443 : 80)
        });

        myPeer.on('open', id => {
            currentPeerId = id;
            socket.emit('register', { username, peerId: id });
        });

        // Слушаем входящие звонки (для зрителей)
        myPeer.on('call', call => {
            call.answer();
            call.on('stream', userVideoStream => {
                remoteVideo.srcObject = userVideoStream;
            });
        });
    }
}

// Функция для стримера
async function startStreaming() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });
        
        // Добавляем микрофон
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getAudioTracks().forEach(track => stream.addTrack(track));

        localVideo.srcObject = stream;
        
        // В реальном приложении нужно разослать сигнал всем пользователям
        // Для MVP: стример "звонит" всем подключенным (упрощенно через socket)
        socket.emit('chat-message', { user: 'Система', text: 'Стрим начался! Обновите страницу, если не видите видео.' });
        
        // Это упрощенная логика: стример ждет подключений
        myPeer.on('connection', conn => {
            // Реализация сложнее для многих зрителей, 
            // WebRTC P2P потянет 5-10 человек на Render Free.
        });

    } catch (err) {
        console.error("Ошибка захвата экрана:", err);
    }
}

function askPassword() {
    const pass = prompt("Введите пароль для стриминга:");
    socket.emit('start-stream-request', pass);
}

socket.on('stream-auth-success', () => {
    startStreaming();
});

socket.on('stream-auth-fail', () => {
    alert("Неверный пароль!");
});

// Чат
function sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value;
    if (msg.startsWith('/donate')) {
        const amount = msg.split(' ')[1];
        socket.emit('send-donation', { user: username, amount: amount });
    } else {
        socket.emit('chat-message', { user: username, text: msg });
    }
    input.value = '';
}

socket.on('chat-message', data => {
    const chat = document.getElementById('chat');
    chat.innerHTML += `<p><span class="text-indigo-400 font-bold">${data.user}:</span> ${data.text}</p>`;
    chat.scrollTop = chat.scrollHeight;
});

// Донаты
socket.on('new-donation', data => {
    const box = document.getElementById('donation-box');
    const text = document.getElementById('donation-text');
    text.innerText = `${data.user} задонатил ${data.amount} RUB!`;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 5000);
});