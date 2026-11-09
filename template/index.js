const yen = n => `¥${Math.max(0, Math.trunc(Number(n) || 0)).toLocaleString('ja-JP')}`;
const byId = id => document.getElementById(id);
let currentState = null,
    eventTimeout,
    taxTimeout;
const audioQueue = [];
let playingAudio = false;
function renderState(s) {
    if (!s) return;
    currentState = s;
    byId('assets').textContent = yen(s.assets);
    byId('target').textContent = yen(s.targetAssets);
    byId('difficulty').textContent = String(s.difficulty || 'easy').toUpperCase();
    byId('tax-count').textContent = String(s.taxCount || 0);
    byId('progress').style.width = `${Math.min(100, (s.assets / Math.max(1, s.targetAssets)) * 100)}%`;
    if (s.status === 'CLEARED') byId('clear').classList.add('show');
}
function popup(name, text, amount, color) {
    const box = byId('event');
    box.style.setProperty('--event-color', color || '#fff');
    box.className = 'show comment';
    byId('name').textContent = name || '';
    byId('text').textContent = text || '';
    byId('amount').textContent = `+${yen(amount)}`;
    clearTimeout(eventTimeout);
    eventTimeout = setTimeout(() => box.classList.remove('show'), 5500);
}
function showTax(p) {
    byId('tax-income').textContent = yen(p.income);
    byId('tax-amount').textContent = yen(p.taxAmount);
    byId('after-tax').textContent = yen(p.assetsAfter);
    byId('tax').classList.add('show');
    clearTimeout(taxTimeout);
    taxTimeout = setTimeout(() => byId('tax').classList.remove('show'), 8000);
}
function queueVoice(payload) {
    if (!payload?.audio) return;
    audioQueue.push(payload.audio);
    if (!playingAudio) playNextVoice();
}
function playNextVoice() {
    const encoded = audioQueue.shift();
    if (!encoded) {
        playingAudio = false;
        return;
    }
    playingAudio = true;
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    const audio = new Audio(url);
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        URL.revokeObjectURL(url);
        playNextVoice();
    };
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(error => {
        console.error('VOICEVOX playback failed', error);
        finish();
    });
}
function connect() {
    const socket = new WebSocket(`ws://${location.host}`);
    socket.onmessage = event => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }
        renderState(message.state);
        if (message.type === 'comment')
            popup(message.payload.name, message.payload.comment, message.payload.amount, message.payload.color);
        if (message.type === 'tax.collected') showTax(message.payload);
        if (message.type === 'tax.voice') queueVoice(message.payload);
    };
    socket.onclose = () => setTimeout(connect, 2000);
}
setInterval(() => {
    if (!currentState || currentState.status !== 'RUNNING') return;
    const seconds = Math.max(0, Math.ceil((currentState.nextTaxAt - Date.now()) / 1000));
    byId('countdown').textContent =
        `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}, 250);
connect();
