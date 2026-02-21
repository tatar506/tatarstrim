// ПРИНУДИТЕЛЬНО ИСПОЛЬЗУЕМ WEBSOCKETS (это уберет ошибки 400/502/CORS)
const socket = io("https://tatarstrim.onrender.com", {
    transports: ['websocket'] 
});

let myPeer, currentNick, myStream, allStreams = [];

// Авторизация БЕЗ проверки сложности
window.handleAuth = (type) => {
    const user = document.getElementById('acc-user').value.trim();
    const pass = document.getElementById('acc-pass').value.trim();
    if (!user || !pass) return alert("Введите данные");

    socket.emit(type === 'login' ? 'login-account' : 'register-account', { 
        username: user, 
        password: pass 
    });
};

socket.on('auth-success', (data) => {
    currentNick = data.username;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('my-nick').innerText = currentNick;
    initPeer();
});

socket.on('auth-error', (e) => alert(e));

function initPeer() {
    myPeer = new Peer(undefined, { 
        host: 'tatarstrim.onrender.com', 
        port: 443, 
        path: '/peerjs', 
        secure: true 
    });
    myPeer.on('call', call => {
        console.log("Отдаю поток зрителю...");
        call.answer(myStream);
    });
}

// Запуск стрима
window.askPassword = () => {
    const p = prompt("Пароль стримера:");
    socket.emit('start-stream-request', p);
};

socket.on('stream-auth-ok', async () => {
    try {
        const quality = document.getElementById('quality').value;
        const constraints = quality === 'high' ? 
            { video: { width: 1280, height: 720 }, audio: true } : 
            { video: { width: 640, height: 360 }, audio: true };
        
        myStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        
        try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            mic.getAudioTracks().forEach(t => myStream.addTrack(t));
        } catch(e) { console.log("Микрофон не добавлен"); }

        document.getElementById('main-video').srcObject = myStream;
        document.getElementById('main-video').muted = true;

        socket.emit('stream-started', { peerId: myPeer.id, user: currentNick });
        alert("Стрим запущен! Не забудьте выбрать 'Поделиться аудио'");
    } catch (e) { alert("Ошибка: " + e); }
});

// Список и Поиск
socket.on('update-stream-list', (list) => {
    allStreams = list;
    renderStreams(list);
});

function renderStreams(list) {
    const container = document.getElementById('stream-list');
    container.innerHTML = list.map(s => `
        <button onclick="joinStream('${s.peerId}', '${s.user}')" class="w-full text-left p-3 bg-slate-800 rounded-xl hover:bg-indigo-600 transition mb-2 border border-slate-700">
            <div class="font-bold">${s.user}</div>
            <div class="text-[10px] text-red-500 font-bold uppercase">В ЭФИРЕ</div>
        </button>
    `).join('') || '<p class="text-slate-600 text-sm">Активных стримов нет</p>';
}

window.filterStreams = () => {
    const q = document.getElementById('search-input').value.toLowerCase();
    renderStreams(allStreams.filter(s => s.user.toLowerCase().includes(q)));
};

function joinStream(id, name) {
    document.getElementById('current-stream-name').innerText = "Смотрим: " + name;
    console.log("Подключаюсь к ID:", id);
    const call = myPeer.call(id, null);
    call.on('stream', rs => {
        const v = document.getElementById('main-video');
        v.srcObject = rs;
        v.play().catch(e => console.log("Нажмите на видео для звука"));
    });
}

// Чат
window.sendMsg = () => {
    const i = document.getElementById('chat-msg');
    if (i.value) {
        socket.emit('chat-message', { user: currentNick, text: i.value });
        i.value = "";
    }
};

socket.on('chat-message', d => {
    const chat = document.getElementById('chat');
    chat.innerHTML += `<div><b class="text-indigo-400">${d.user}:</b> ${d.text}</div>`;
    chat.scrollTop = chat.scrollHeight;
});

// Донаты и Подписки
window.sendFakeAction = (type) => {
    if (type === 'donate') socket.emit('send-donation', { user: currentNick, amount: 500 });
    else socket.emit('send-sub', { user: currentNick });
};

socket.on('alert', d => {
    const box = document.getElementById('alert-box');
    const title = document.getElementById('alert-title');
    const body = document.getElementById('alert-body');
    
    box.classList.remove('hidden');
    title.innerText = d.type === 'donation' ? 'НОВЫЙ ДОНАТ!' : 'НОВАЯ ПОДПИСКА!';
    body.innerText = d.type === 'donation' ? `${d.user}: ${d.amount} RUB` : `${d.user} ПОДПИСАЛСЯ!`;
    
    setTimeout(() => box.classList.add('hidden'), 4000);
});
