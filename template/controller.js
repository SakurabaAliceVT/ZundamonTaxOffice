const endpoint = '/api/plugins/com.sakurabaalicevt.liveapp.zundamontaxoffice';
const byId = id => document.getElementById(id);
const money = value => `¥${Math.trunc(Number(value) || 0).toLocaleString('ja-JP')}`;

async function request(method, body) {
    const response = await fetch(endpoint, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || result.code >= 400) throw new Error(result.response?.error || 'リクエストに失敗しました');
    return result.response;
}

function render(result) {
    const config = result.config || {};
    const state = result.state || {};
    const voice = config.voicevox || {};
    if (config.difficulty) byId('difficulty').value = config.difficulty;
    if (config.targetAssets) byId('target').value = config.targetAssets;
    if (config.taxIntervalSeconds) byId('interval').value = config.taxIntervalSeconds;
    if (config.taxDriver) byId('driver').value = config.taxDriver;
    if (voice.url) byId('voicevoxUrl').value = voice.url;
    if (Number.isInteger(voice.speaker)) byId('voicevoxSpeaker').value = voice.speaker;
    if (Number.isFinite(voice.speed)) byId('voicevoxSpeed').value = voice.speed;
    if (Number.isFinite(voice.pitch)) byId('voicevoxPitch').value = voice.pitch;
    if (Number.isFinite(voice.volume)) byId('voicevoxVolume').value = voice.volume;
    if (voice.taxableTemplate) byId('taxableTemplate').value = voice.taxableTemplate;
    if (voice.noTaxTemplate) byId('noTaxTemplate').value = voice.noTaxTemplate;
    byId('summary').textContent =
        `状態: ${state.status || '不明'} / 資産: ${money(state.assets)} / 累積収入: ${money(state.totalIncome)} / 累計税額: ${money(state.totalTax)} / 徴税回数: ${state.taxCount || 0}`;
}

async function refresh() {
    render(await request('GET'));
}

byId('settings').addEventListener('submit', async event => {
    event.preventDefault();
    try {
        render(
            await request('PUT', {
                difficulty: byId('difficulty').value,
                targetAssets: Number(byId('target').value),
                taxIntervalSeconds: Number(byId('interval').value),
                taxDriver: byId('driver').value,
                voicevox: {
                    url: byId('voicevoxUrl').value,
                    speaker: Number(byId('voicevoxSpeaker').value),
                    speed: Number(byId('voicevoxSpeed').value),
                    pitch: Number(byId('voicevoxPitch').value),
                    volume: Number(byId('voicevoxVolume').value),
                    taxableTemplate: byId('taxableTemplate').value,
                    noTaxTemplate: byId('noTaxTemplate').value,
                },
            })
        );
        byId('status').textContent = '設定を保存しました';
    } catch (error) {
        byId('status').textContent = error.message;
    }
});

byId('taxNow').addEventListener('click', async () => {
    try {
        await request('POST', { action: 'tax' });
        byId('status').textContent = '徴税を開始しました';
    } catch (error) {
        byId('status').textContent = error.message;
    }
});

byId('reset').addEventListener('click', async () => {
    if (!confirm('資産・累積金額・税額をリセットしますか？')) return;
    try {
        render(await request('POST', { action: 'reset' }));
        byId('status').textContent = 'チャレンジをリセットしました';
    } catch (error) {
        byId('status').textContent = error.message;
    }
});

refresh().catch(error => {
    byId('status').textContent = error.message;
    byId('summary').textContent = 'OneCommeを起動し、プラグインを有効にしてください。';
});
setInterval(() => refresh().catch(() => {}), 3000);
