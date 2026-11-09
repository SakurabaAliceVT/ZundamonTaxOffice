import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import getCalculator from './taxCalculator.js';
import getChatColor from './chatColor.js';
import { createTaxScript, synthesizeTaxVoice, type VoicevoxConfig } from './voicevox.js';

const listenPort = 40100;
const defaultConfig = {
    targetAssets: 100_000_000,
    taxIntervalSeconds: 3600,
    difficulty: 'easy' as Difficulty,
    taxDriver: 'income_tax',
    voicevox: {
        url: 'http://127.0.0.1:50021',
        speaker: 1,
        speed: 1,
        pitch: 0,
        volume: 1,
        taxableTemplate: '税務署です。所得金額は{income}円、税額は{taxAmount}円です。納税お願いします。',
        noTaxTemplate: '税務署です。今回は納税額がありません。',
    } satisfies VoicevoxConfig,
};
type Difficulty = 'easy' | 'normal' | 'hard' | 'hell';
type CommentData = {
    id?: string;
    name?: string;
    displayName?: string;
    comment?: string;
    service?: string;
    meta?: { isUpdate?: boolean };
};
type ChallengeState = {
    status: 'RUNNING' | 'CLEARED';
    startedAt: number;
    assets: number;
    totalIncome: number;
    intervalIncome: number;
    totalTax: number;
    taxCount: number;
    targetAssets: number;
    difficulty: Difficulty;
    taxDriver: string;
    taxIntervalSeconds: number;
    nextTaxAt: number;
};

let server: http.Server | undefined;
let wss: WebSocketServer | undefined;
let taxTimer: ReturnType<typeof setInterval> | undefined;
let state: ChallengeState | undefined;
let taxInProgressToken: number | undefined;
let lifecycleVersion = 0;
let logger: Pick<Console, 'info' | 'error'> = console;
let store: { get(key: string): unknown; set(key: string, value: unknown): void } | undefined;
let runtimeConfig: typeof defaultConfig = defaultConfig;
let voiceQueue: Promise<void> = Promise.resolve();
const connections = new Set<WebSocket>();
const seenCommentIds = new Set<string>();

function broadcast(type: string, payload: unknown) {
    if (!wss || !state) return;
    const message = JSON.stringify({ type, payload, state: publicState() });
    for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
    }
}

function publicState() {
    if (!state) return null;
    return {
        status: state.status,
        startedAt: state.startedAt,
        assets: state.assets,
        totalIncome: state.totalIncome,
        intervalIncome: state.intervalIncome,
        totalTax: state.totalTax,
        taxCount: state.taxCount,
        targetAssets: state.targetAssets,
        difficulty: state.difficulty,
        nextTaxAt: state.nextTaxAt,
    };
}

function persistState() {
    if (state) store?.set('challengeState', state);
}

function validSavedState(value: unknown): value is ChallengeState {
    if (!value || typeof value !== 'object') return false;
    const saved = value as Partial<ChallengeState>;
    return (
        ['RUNNING', 'CLEARED'].includes(String(saved.status)) &&
        Number.isFinite(saved.assets) &&
        Number.isFinite(saved.totalIncome) &&
        Number.isFinite(saved.intervalIncome) &&
        Number.isFinite(saved.nextTaxAt) &&
        ['easy', 'normal', 'hard', 'hell'].includes(String(saved.difficulty))
    );
}

function serveOverlay(req: http.IncomingMessage, res: http.ServerResponse) {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (req.method !== 'GET' || (pathname !== '/' && pathname !== '/overlay')) {
        res.writeHead(404).end('Not found');
        return;
    }
    try {
        const html = fs.readFileSync(path.join(__dirname, 'static', 'index.html'));
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(html);
    } catch (error) {
        logger.error('[Overlay Error]', error);
        res.writeHead(500).end('Overlay file not found');
    }
}

function startServer() {
    server = http.createServer(serveOverlay);
    wss = new WebSocketServer({ server });
    wss.on('connection', ws => {
        connections.add(ws);
        ws.send(JSON.stringify({ type: 'state', payload: null, state: publicState() }));
        ws.on('close', () => connections.delete(ws));
        ws.on('error', error => logger.error('[WS Error]', error));
    });
    server.on('error', error => logger.error('[HTTP Server Error]', error));
    server.listen(listenPort, '127.0.0.1', () => logger.info(`Overlay: http://127.0.0.1:${listenPort}/`));
}

function startTaxTimer() {
    if (taxTimer) clearInterval(taxTimer);
    taxTimer = setInterval(() => {
        if (state?.status === 'RUNNING' && Date.now() >= state.nextTaxAt) void collectTax();
    }, 500);
    taxTimer.unref?.();
}

function commentItems(value: unknown): CommentData[] {
    if (Array.isArray(value)) return value.filter((item): item is CommentData => !!item && typeof item === 'object');
    if (value && typeof value === 'object' && Array.isArray((value as { comments?: unknown }).comments))
        return commentItems((value as { comments: unknown }).comments);
    return value && typeof value === 'object' ? [value as CommentData] : [];
}

function onComment(comment: CommentData) {
    if (!state || state.status !== 'RUNNING' || comment.meta?.isUpdate) return;
    if (comment.id) {
        if (seenCommentIds.has(comment.id)) return;
        seenCommentIds.add(comment.id);
        if (seenCommentIds.size > 5000) seenCommentIds.delete(seenCommentIds.values().next().value as string);
    }
    const { color, price } = getChatColor();
    state.assets += price;
    state.intervalIncome += price;
    state.totalIncome += price;
    broadcast('comment', {
        id: comment.id,
        name: comment.displayName || comment.name || '視聴者',
        comment: comment.comment || '',
        service: comment.service,
        color,
        amount: price,
    });
    if (state.assets >= state.targetAssets) {
        state.status = 'CLEARED';
        if (taxTimer) clearInterval(taxTimer);
        taxTimer = undefined;
        broadcast('clear', { finalAssets: state.assets, totalIncome: state.totalIncome, totalTax: state.totalTax });
    }
    persistState();
}

async function collectTax() {
    if (!state || state.status !== 'RUNNING' || taxInProgressToken === lifecycleVersion) return;
    const version = lifecycleVersion;
    const taxState = state;
    taxInProgressToken = version;
    const intervalIncome = state.intervalIncome;
    state.intervalIncome = 0;
    const income = Math.floor(
        state.difficulty === 'easy'
            ? intervalIncome / 2
            : state.difficulty === 'normal'
              ? intervalIncome
              : state.difficulty === 'hard'
                ? state.totalIncome / 2
                : state.totalIncome
    );
    const assetsBefore = state.assets;
    broadcast('tax.started', { income, difficulty: state.difficulty, assetsBefore });
    try {
        const calculate = await getCalculator(taxState.taxDriver);
        if (version !== lifecycleVersion || state !== taxState) return;
        const calculatedTax = calculate(income);
        if (!Number.isFinite(calculatedTax) || calculatedTax < 0) throw new Error('Invalid tax result');
        const assetsBeforeCollection = state.assets;
        const taxAmount = Math.min(state.assets, Math.floor(calculatedTax));
        state.assets -= taxAmount;
        state.totalTax += taxAmount;
        state.taxCount += 1;
        state.nextTaxAt = Date.now() + state.taxIntervalSeconds * 1000;
        persistState();
        const script = createTaxScript(runtimeConfig.voicevox, income, taxAmount);
        broadcast('tax.collected', {
            income,
            calculatedTax: Math.floor(calculatedTax),
            taxAmount,
            assetsBefore: assetsBeforeCollection,
            assetsAfter: state.assets,
            taxCount: state.taxCount,
            script,
        });
        const voicevoxConfig = { ...runtimeConfig.voicevox };
        voiceQueue = voiceQueue.then(async () => {
            try {
                const voice = await synthesizeTaxVoice(voicevoxConfig, script);
                if (version === lifecycleVersion && state === taxState) broadcast('tax.voice', voice);
            } catch (error) {
                logger.error('[VOICEVOX Error]', error);
                if (version === lifecycleVersion && state === taxState)
                    broadcast('tax.voice.error', {
                        script,
                        message: error instanceof Error ? error.message : String(error),
                    });
            }
        });
    } catch (error) {
        logger.error('[Tax Error]', error);
        if (version === lifecycleVersion && state === taxState) state.intervalIncome += intervalIncome;
        if (version === lifecycleVersion && state === taxState) {
            state.nextTaxAt = Date.now() + 5000;
            persistState();
        }
        if (version === lifecycleVersion && state === taxState)
            broadcast('tax.error', { message: error instanceof Error ? error.message : String(error) });
    } finally {
        if (taxInProgressToken === version) taxInProgressToken = undefined;
    }
}

export = {
    name: 'Zundamon Tax Office',
    uid: 'com.sakurabaalicevt.liveapp.zundamontaxoffice',
    version: '1.0.0',
    author: '桜羽ありす',
    url: 'http://localhost:11180/plugins/com.sakurabaalicevt.liveapp.zundamontaxoffice/static/controller.html',
    permissions: ['comments'],
    defaultState: { config: defaultConfig },
    init(
        api?: {
            log?: Pick<Console, 'info' | 'error'>;
            store?: { get(key: string): unknown; set(key: string, value: unknown): void };
        },
        initialData?: { config?: Partial<typeof defaultConfig>; challengeState?: unknown }
    ) {
        logger = api?.log ?? console;
        store = api?.store;
        const savedConfig = initialData?.config ?? (store?.get('config') as Partial<typeof defaultConfig> | undefined);
        const config = { ...defaultConfig, ...(savedConfig ?? {}) };
        config.voicevox = { ...defaultConfig.voicevox, ...(savedConfig?.voicevox ?? {}) };
        runtimeConfig = config;
        const difficulty: Difficulty = ['easy', 'normal', 'hard', 'hell'].includes(config.difficulty)
            ? config.difficulty
            : 'easy';
        const savedState = initialData?.challengeState ?? store?.get('challengeState');
        state = validSavedState(savedState)
            ? savedState
            : {
                  status: 'RUNNING',
                  startedAt: Date.now(),
                  assets: 0,
                  totalIncome: 0,
                  intervalIncome: 0,
                  totalTax: 0,
                  taxCount: 0,
                  targetAssets:
                      Number.isFinite(config.targetAssets) && config.targetAssets > 0
                          ? config.targetAssets
                          : defaultConfig.targetAssets,
                  difficulty,
                  taxDriver: /^[a-z0-9_-]+$/i.test(config.taxDriver) ? config.taxDriver : defaultConfig.taxDriver,
                  taxIntervalSeconds:
                      Number.isFinite(config.taxIntervalSeconds) && config.taxIntervalSeconds > 0
                          ? config.taxIntervalSeconds
                          : defaultConfig.taxIntervalSeconds,
                  nextTaxAt:
                      Date.now() +
                      (Number.isFinite(config.taxIntervalSeconds) && config.taxIntervalSeconds > 0
                          ? config.taxIntervalSeconds
                          : defaultConfig.taxIntervalSeconds) *
                          1000,
              };
        seenCommentIds.clear();
        lifecycleVersion += 1;
        taxInProgressToken = undefined;
        startServer();
        persistState();
        startTaxTimer();
    },
    subscribe(type: string, ...args: unknown[]) {
        if (type !== 'comments') return;
        for (const comment of commentItems(args[0])) onComment(comment);
    },
    request(req: { method: string; url: string; body?: unknown }) {
        if (req.method === 'GET')
            return Promise.resolve({ code: 200, response: { config: runtimeConfig, state: publicState() } });
        let requested: Record<string, unknown> = {};
        if (req.body !== undefined) {
            try {
                requested = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Record<string, unknown>);
            } catch {
                return Promise.resolve({ code: 400, response: { error: 'Invalid JSON' } });
            }
        }
        if (req.method === 'PUT') {
            if (!requested || typeof requested !== 'object' || !state)
                return Promise.resolve({ code: 400, response: { error: 'Invalid configuration' } });
            if (Number.isFinite(requested.targetAssets) && Number(requested.targetAssets) > 0)
                state.targetAssets = Number(requested.targetAssets);
            if (Number.isFinite(requested.taxIntervalSeconds) && Number(requested.taxIntervalSeconds) > 0) {
                state.taxIntervalSeconds = Number(requested.taxIntervalSeconds);
                state.nextTaxAt = Date.now() + state.taxIntervalSeconds * 1000;
            }
            if (['easy', 'normal', 'hard', 'hell'].includes(String(requested.difficulty)))
                state.difficulty = requested.difficulty as Difficulty;
            if (typeof requested.taxDriver === 'string' && /^[a-z0-9_-]+$/i.test(requested.taxDriver)) {
                state.taxDriver = requested.taxDriver;
            }
            if (requested.voicevox && typeof requested.voicevox === 'object') {
                const voicevox = requested.voicevox as Partial<VoicevoxConfig>;
                const url = typeof voicevox.url === 'string' ? voicevox.url : runtimeConfig.voicevox.url;
                try {
                    const parsedUrl = new URL(url);
                    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('invalid protocol');
                    runtimeConfig.voicevox = {
                        url: parsedUrl.toString().replace(/\/$/, ''),
                        speaker:
                            Number.isInteger(voicevox.speaker) && Number(voicevox.speaker) >= 0
                                ? Number(voicevox.speaker)
                                : runtimeConfig.voicevox.speaker,
                        speed:
                            Number.isFinite(voicevox.speed) && Number(voicevox.speed) > 0
                                ? Number(voicevox.speed)
                                : runtimeConfig.voicevox.speed,
                        pitch: Number.isFinite(voicevox.pitch) ? Number(voicevox.pitch) : runtimeConfig.voicevox.pitch,
                        volume:
                            Number.isFinite(voicevox.volume) && Number(voicevox.volume) >= 0
                                ? Number(voicevox.volume)
                                : runtimeConfig.voicevox.volume,
                        taxableTemplate:
                            typeof voicevox.taxableTemplate === 'string' &&
                            voicevox.taxableTemplate.includes('{taxAmount}')
                                ? voicevox.taxableTemplate
                                : runtimeConfig.voicevox.taxableTemplate,
                        noTaxTemplate:
                            typeof voicevox.noTaxTemplate === 'string'
                                ? voicevox.noTaxTemplate
                                : runtimeConfig.voicevox.noTaxTemplate,
                    };
                } catch {
                    return Promise.resolve({ code: 400, response: { error: 'VOICEVOX URL must be http or https' } });
                }
            }
            store?.set('config', {
                targetAssets: state.targetAssets,
                taxIntervalSeconds: state.taxIntervalSeconds,
                difficulty: state.difficulty,
                taxDriver: state.taxDriver,
                voicevox: runtimeConfig.voicevox,
            });
            persistState();
            broadcast('state', null);
            return Promise.resolve({ code: 200, response: { config: runtimeConfig, state: publicState() } });
        }
        if (req.method === 'POST' && (req.url === '/tax' || requested.action === 'tax')) {
            void collectTax();
            return Promise.resolve({ code: 200, response: publicState() });
        }
        if (req.method === 'POST' && (req.url === '/reset' || requested.action === 'reset')) {
            if (!state) return Promise.resolve({ code: 500, response: { error: 'Not initialized' } });
            lifecycleVersion += 1;
            const now = Date.now();
            state = {
                ...state,
                status: 'RUNNING',
                startedAt: now,
                assets: 0,
                totalIncome: 0,
                intervalIncome: 0,
                totalTax: 0,
                taxCount: 0,
                nextTaxAt: now + state.taxIntervalSeconds * 1000,
            };
            seenCommentIds.clear();
            startTaxTimer();
            persistState();
            broadcast('state', null);
            return Promise.resolve({ code: 200, response: publicState() });
        }
        return Promise.resolve({ code: 404, response: { error: 'Not found' } });
    },
    destroy() {
        lifecycleVersion += 1;
        taxInProgressToken = undefined;
        if (taxTimer) clearInterval(taxTimer);
        taxTimer = undefined;
        for (const ws of connections) ws.close();
        connections.clear();
        wss?.close();
        wss = undefined;
        server?.close();
        server = undefined;
        store = undefined;
        state = undefined;
    },
};
