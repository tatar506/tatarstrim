let socket = io(); // Теперь io будет определен, так как мы добавили CDN
let myPeer;
let currentUsername = "";

function registerUser() {
    const input = document.getElementById('username-input');
    currentUsername = input.value.trim();

    if (currentUsername === "") {
        alert("Введите ник!");
        return;
    }

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');

    // Инициализация PeerJS
    myPeer = new Peer(undefined, {
        host: location.hostname,
        port: location.port || (location.protocol === 'https:' ? 443 : 80),
        path: '/peerjs',
        secure: location.protocol === 'https:'
    });

    myPeer.on('open', id => {
        console.log('Мой Peer ID:', id);
        socket.emit('register', { username: currentUsername, peerId: id });
    });

    myPeer.on('call', call => {
        call.answer();
        call.on('stream', userVideoStream => {
            document.getElementById('remote-video').srcObject = userVideoStream;
        });
    });
}

async function startStreaming() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        // Добавляем микрофон
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getAudioTracks().forEach(track => stream.addTrack(track));
        } catch(e) { console.log("Микрофон не найден или запрещен"); }

        document.getElementById('remote-video').srcObject = stream;
        
        socket.emit('chat-message', { user: 'СИСТЕМА', text: 'Стрим начался! Нажмите на плеер, если нет звука.' });

        // В этом MVP мы просто показываем видео локально. 
        // Для полноценного вещания на всех нужно передавать ID стримера.
    } catch (err) {
        alert("Ошибка доступа к экрану: " + err);
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
    chat.innerHTML += `<div class="bg-slate-700/50 p-2 rounded shadow-sm"><span class="text-indigo-400 font-bold">${data.user}:</span> <span class="text-slate-200">${data.text}</span></div>`;
    chat.scrollTop = chat.scrollHeight;
});

socket.on('new-donation', data => {
    const box = document.getElementById('donation-box');
    const text = document.getElementById('donation-text');
    text.innerText = `${data.user.toUpperCase()} задонатил ${data.amount} RUB!`;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 5000);
});
