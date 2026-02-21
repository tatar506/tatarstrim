// 1. Указываем адрес сервера явно, чтобы не было ошибок 404
const socket = io("https://tatarstrim.onrender.com"); 

let myPeer;
let currentUsername = "";
let myStream; // Здесь будет храниться поток видео

function registerUser() {
    const input = document.getElementById('username-input');
    currentUsername = input.value.trim();

    if (currentUsername === "") {
        alert("Введите ник!");
        return;
    }

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');

    // 2. Настройка PeerJS (видео-связь)
    myPeer = new Peer(undefined, {
        host: "tatarstrim.onrender.com", // Явно указываем хост
        port: 443,
        path: '/peerjs',
        secure: true
    });

    myPeer.on('open', id => {
        console.log('Мой Peer ID:', id);
        socket.emit('register', { username: currentUsername, peerId: id });
    });

    // Когда кто-то "звонит" нам (зритель подключается к стримеру)
    myPeer.on('call', call => {
        if (myStream) {
            console.log("Отдаю поток зрителю...");
            call.answer(myStream); // Отправляем наш видео-поток зрителю
        }
    });
}

// ФУНКЦИЯ ДЛЯ СТРИМЕРА (ДЛЯ ТЕБЯ)
async function startStreaming() {
    try {
        // Захват экрана и звука системы
        myStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true
        });

        // Добавляем микрофон к общему потоку
        try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStream.getAudioTracks().forEach(track => myStream.addTrack(track));
        } catch(e) { console.log("Микрофон не подключен"); }

        const videoElement = document.getElementById('remote-video');
        videoElement.srcObject = myStream;
        videoElement.muted = true; // Чтобы не слышать самого себя

        // Оповещаем сервер, что стрим начался и передаем наш Peer ID
        socket.emit('stream-started', { peerId: myPeer.id });
        
        socket.emit('chat-message', { user: 'СИСТЕМА', text: 'Трансляция началась!' });

    } catch (err) {
        alert("Ошибка захвата экрана: " + err);
    }
}

// ЛОГИКА ДЛЯ ЗРИТЕЛЕЙ (ПОЛУЧЕНИЕ СТРИМА)
socket.on('stream-available', (streamerPeerId) => {
    if (myPeer && streamerPeerId !== myPeer.id) {
        console.log("Подключаюсь к стримеру:", streamerPeerId);
        const call = myPeer.call(streamerPeerId, null); // "Звоним" стримеру без своего видео
        call.on('stream', userVideoStream => {
            document.getElementById('remote-video').srcObject = userVideoStream;
        });
    }
});

// ПАРОЛЬ И ЧАТ
function askPassword() {
    const pass = prompt("Введите паро letter для стриминга:");
    socket.emit('start-stream-request', pass);
}

socket.on('stream-auth-success', () => {
    startStreaming();
});

socket.on('stream-auth-fail', () => {
    alert("Неверный пароль!");
});

function sendMessage() {
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
}

socket.on('chat-message', data => {
    const chat = document.getElementById('chat');
    chat.innerHTML += `<div class="bg-slate-700/50 p-2 rounded"><span class="text-indigo-400 font-bold">${data.user}:</span> <span class="text-slate-200">${data.text}</span></div>`;
    chat.scrollTop = chat.scrollHeight;
});

socket.on('new-donation', data => {
    const box = document.getElementById('donation-box');
    const text = document.getElementById('donation-text');
    text.innerText = `${data.user.toUpperCase()} задонатил ${data.amount} RUB!`;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 5000);
});
