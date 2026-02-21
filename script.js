const socket = io("https://tatarstrim.onrender.com");
let myPeer;
let currentUsername = "";
let myStream;

// Глобальная функция регистрации
window.registerUser = function() {
    const nick = document.getElementById('username-input').value.trim();
    if (!nick) return alert("Введите ник");
    currentUsername = nick;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');

    myPeer = new Peer(undefined, {
        host: "tatarstrim.onrender.com",
        port: 443,
        path: '/peerjs',
        secure: true
    });

    myPeer.on('open', id => {
        socket.emit('register', { username: currentUsername, peerId: id });
    });

    // Когда нам звонит зритель, отдаем ему свой поток
    myPeer.on('call', call => {
        if (myStream) {
            call.answer(myStream);
        }
    });
};

// Функция для запуска стрима
async function startStreaming() {
    try {
        // ЗАХВАТ ЭКРАНА + ГАЛОЧКА "ОБЩИЙ ДОСТУП К АУДИО"
        myStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true // ЭТО ДЛЯ ЗВУКА СИСТЕМЫ
        });

        // Добавляем микрофон, если нужно
        try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            mic.getAudioTracks().forEach(track => myStream.addTrack(track));
        } catch(e) { console.log("Микрофон не выбран"); }

        const video = document.getElementById('remote-video');
        video.srcObject = myStream;
        video.muted = true; // Стример не должен слышать сам себя

        socket.emit('stream-started', { peerId: myPeer.id, user: currentUsername });
        addMessage("СИСТЕМА", "Вы в эфире!");
    } catch (err) {
        alert("Ошибка: " + err);
    }
}

// Обновление списка стримов
socket.on('update-stream-list', (streamers) => {
    const list = document.getElementById('stream-list');
    list.innerHTML = "";
    
    if (streamers.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-sm italic">Активных стримов нет...</p>';
    }

    streamers.forEach(s => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left p-3 bg-slate-800 rounded-xl hover:bg-indigo-600 transition mb-2 border border-slate-700";
        btn.innerHTML = `<div class="font-bold text-white">${s.user}</div><div class="text-xs text-indigo-300">LIVE • Нажмите, чтобы смотреть</div>`;
        btn.onclick = () => joinStream(s.peerId, s.user);
        list.appendChild(btn);
    });
});

// Подключение к стриму
function joinStream(peerId, name) {
    console.log("Подключаюсь к", name);
    document.getElementById('stream-title').innerText = "Стрим: " + name;
    
    // "Звоним" стримеру
    const call = myPeer.call(peerId, null);
    call.on('stream', remoteStream => {
        const video = document.getElementById('remote-video');
        video.srcObject = remoteStream;
        // Важно: на многих браузерах звук не включится, пока пользователь не кликнет по видео
        video.play(); 
    });
}

// Пароль и остальное
window.askPassword = function() {
    const p = prompt("Пароль:");
    socket.emit('start-stream-request', p);
};

socket.on('stream-auth-success', startStreaming);

// Чат
window.sendMessage = function() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    if (msg.startsWith('/donate')) {
        socket.emit('send-donation', { user: currentUsername, amount: msg.split(' ')[1] || "100" });
    } else {
        socket.emit('chat-message', { user: currentUsername, text: msg });
    }
    input.value = "";
};

socket.on('chat-message', d => addMessage(d.user, d.text));

function addMessage(u, t) {
    const c = document.getElementById('chat');
    c.innerHTML += `<div><b class="text-indigo-400">${u}:</b> ${t}</div>`;
    c.scrollTop = c.scrollHeight;
}

socket.on('new-donation', d => {
    const b = document.getElementById('donation-box');
    document.getElementById('donation-text').innerText = `${d.user} задонатил ${d.amount} RUB!`;
    b.classList.remove('hidden');
    setTimeout(() => b.classList.add('hidden'), 5000);
});
