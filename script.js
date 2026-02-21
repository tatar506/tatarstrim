// ПРИНУДИТЕЛЬНОЕ ПОДКЛЮЧЕНИЕ К RENDER
const RENDER_URL = "https://tatarstrim.onrender.com";
const socket = io(RENDER_URL);

let myPeer;
let currentUsername = "";
let myStream;

// Функция регистрации (теперь она точно будет видна браузеру)
window.registerUser = function() {
    const input = document.getElementById('username-input');
    currentUsername = input.value.trim();

    if (!currentUsername) {
        alert("Пожалуйста, введите ник!");
        return;
    }

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');

    // Настройка PeerJS для видео
    myPeer = new Peer(undefined, {
        host: "tatarstrim.onrender.com",
        port: 443,
        path: '/peerjs',
        secure: true
    });

    myPeer.on('open', id => {
        console.log('Мой Peer ID:', id);
        socket.emit('register', { username: currentUsername, peerId: id });
    });

    // Когда нам звонит зритель
    myPeer.on('call', call => {
        if (myStream) {
            call.answer(myStream);
        }
    });
};

// Функция старта стрима
async function startStreaming() {
    try {
        myStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true
        });

        const videoElement = document.getElementById('remote-video');
        videoElement.srcObject = myStream;
        videoElement.muted = true;

        socket.emit('stream-started', { peerId: myPeer.id });
        addChatMessage('СИСТЕМА', 'Трансляция запущена!');

    } catch (err) {
        alert("Ошибка доступа: " + err);
    }
}

// Слушаем появление стримера (для зрителей)
socket.on('stream-available', (streamerPeerId) => {
    if (myPeer && streamerPeerId !== myPeer.id) {
        console.log("Стрим обнаружен, подключаюсь...");
        const call = myPeer.call(streamerPeerId, null);
        call.on('stream', userVideoStream => {
            document.getElementById('remote-video').srcObject = userVideoStream;
        });
    }
});

// Работа с паролем
window.askPassword = function() {
    const pass = prompt("Введите пароль стримера:");
    socket.emit('start-stream-request', pass);
};

socket.on('stream-auth-success', () => {
    startStreaming();
});

socket.on('stream-auth-fail', () => {
    alert("Неверный пароль!");
});

// Чат и донаты
window.sendMessage = function() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    if (msg.startsWith('/donate')) {
        const amount = msg.split(' ')[1] || "100";
        socket.emit('send-donation', { user: currentUsername, amount: amount });
    } else {
        socket.emit('chat-message', { user: currentUsername, text: msg });
    }
    input.value = '';
};

socket.on('chat-message', data => {
    addChatMessage(data.user, data.text);
});

socket.on('new-donation', data => {
    const box = document.getElementById('donation-box');
    const text = document.getElementById('donation-text');
    text.innerText = `${data.user.toUpperCase()} — ${data.amount} РУБ.`;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 5000);
});

function addChatMessage(user, text) {
    const chat = document.getElementById('chat');
    const color = user === currentUsername ? 'text-indigo-400' : 'text-slate-400';
    chat.innerHTML += `<div><span class="${color} font-bold">${user}:</span> <span>${text}</span></div>`;
    chat.scrollTop = chat.scrollHeight;
}
