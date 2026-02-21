const socket = io("https://tatarstrim.onrender.com");
let myPeer, currentNick, myStream, allStreams = [];

// Проверка сложности пароля
function isStrongPassword(p) {
    return p.length >= 8 && /\d/.test(p) && /[!@#$%^&*]/.test(p);
}

window.handleAuth = (type) => {
    const user = document.getElementById('acc-user').value.trim();
    const pass = document.getElementById('acc-pass').value.trim();
    const msg = document.getElementById('auth-msg');

    if (!user || !pass) return msg.innerText = "Заполните все поля!";
    if (type === 'register' && !isStrongPassword(pass)) {
        return msg.innerText = "Слишком простой пароль!";
    }

    socket.emit(type === 'login' ? 'login-account' : 'register-account', { username: user, password: pass });
};

socket.on('auth-success', (data) => {
    currentNick = data.username;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('my-nick').innerText = currentNick;
    initPeer();
});

socket.on('auth-error', (e) => document.getElementById('auth-msg').innerText = e);

function initPeer() {
    myPeer = new Peer(undefined, { host: 'tatarstrim.onrender.com', port: 443, path: '/peerjs', secure: true });
    myPeer.on('call', call => call.answer(myStream));
}

// Стрим
window.askPassword = () => {
    const p = prompt("Введите мастер-пароль для стриминга:");
    socket.emit('start-stream-request', p);
};

socket.on('stream-auth-ok', async () => {
    try {
        const quality = document.getElementById('quality').value;
        const constraints = quality === 'high' ? { video: { width: 1920, height: 1080 } } : { video: { width: 854, height: 480 } };
        
        myStream = await navigator.mediaDevices.getDisplayMedia({ video: constraints, audio: true });
        try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            mic.getAudioTracks().forEach(t => myStream.addTrack(t));
        } catch(e) {}

        document.getElementById('main-video').srcObject = myStream;
        socket.emit('stream-started', { peerId: myPeer.id, user: currentNick });
    } catch (e) { alert("Ошибка захвата: " + e); }
});

// Список и Поиск
socket.on('update-stream-list', (list) => {
    allStreams = list;
    renderStreams(list);
});

function renderStreams(list) {
    const container = document.getElementById('stream-list');
    container.innerHTML = list.map(s => `
        <button onclick="joinStream('${s.peerId}', '${s.user}')" class="w-full text-left p-3 glass rounded-2xl hover:bg-indigo-600 transition group">
            <div class="font-bold group-hover:text-white">${s.user}</div>
            <div class="text-[10px] text-indigo-400 uppercase tracking-widest">Live Now</div>
        </button>
    `).join('') || '<p class="text-slate-600 text-sm italic">Никто не стримит...</p>';
}

window.filterStreams = () => {
    const query = document.getElementById('search-input').value.toLowerCase();
    renderStreams(allStreams.filter(s => s.user.toLowerCase().includes(query)));
};

function joinStream(id, name) {
    document.getElementById('current-stream-name').innerText = name;
    const call = myPeer.call(id, null);
    call.on('stream', rs => {
        const v = document.getElementById('main-video');
        v.srcObject = rs;
        v.play();
    });
}

// Чат и Алерт
window.sendMsg = () => {
    const i = document.getElementById('chat-msg');
    if (i.value) {
        socket.emit('chat-message', { user: currentNick, text: i.value });
        i.value = "";
    }
};

socket.on('chat-message', d => {
    const chat = document.getElementById('chat');
    chat.innerHTML += `<div><span class="text-indigo-400 font-bold">${d.user}:</span> <span class="text-slate-300">${d.text}</span></div>`;
    chat.scrollTop = chat.scrollHeight;
});

window.sendFakeAction = (type) => {
    if (type === 'donate') socket.emit('send-donation', { user: currentNick, amount: Math.floor(Math.random() * 1000) });
    else socket.emit('send-sub', { user: currentNick });
};

socket.on('alert', d => {
    const box = document.getElementById('alert-box');
    box.classList.remove('hidden');
    document.getElementById('alert-title').innerText = d.type === 'donation' ? 'НОВЫЙ ДОНАТ!' : 'НОВАЯ ПОДПИСКА!';
    document.getElementById('alert-body').innerText = d.type === 'donation' ? `${d.user} прислал ${d.amount} руб.` : `${d.user} теперь с нами!`;
    setTimeout(() => box.classList.add('hidden'), 4500);
});
