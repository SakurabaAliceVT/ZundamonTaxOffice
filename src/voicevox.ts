export type VoicevoxConfig = {
    url: string;
    speaker: number;
    speed: number;
    pitch: number;
    volume: number;
    taxableTemplate: string;
    noTaxTemplate: string;
};

export type TaxVoice = { script: string; audio: string };

export function createTaxScript(config: VoicevoxConfig, income: number, taxAmount: number) {
    const template = taxAmount > 0 ? config.taxableTemplate : config.noTaxTemplate;
    return template
        .replaceAll('{income}', Math.trunc(income).toLocaleString('ja-JP'))
        .replaceAll('{taxAmount}', Math.trunc(taxAmount).toLocaleString('ja-JP'));
}

export async function synthesizeTaxVoice(config: VoicevoxConfig, script: string): Promise<TaxVoice> {
    const baseUrl = config.url.replace(/\/$/, '');
    const queryResponse = await fetch(
        `${baseUrl}/audio_query?text=${encodeURIComponent(script)}&speaker=${config.speaker}`,
        { method: 'POST', signal: AbortSignal.timeout(30_000) }
    );
    if (!queryResponse.ok) throw new Error(`VOICEVOX audio_query returned ${queryResponse.status}`);
    const query = (await queryResponse.json()) as Record<string, unknown>;
    query.speedScale = config.speed;
    query.pitchScale = config.pitch;
    query.volumeScale = config.volume;

    const audioResponse = await fetch(`${baseUrl}/synthesis?speaker=${config.speaker}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(query),
        signal: AbortSignal.timeout(60_000),
    });
    if (!audioResponse.ok) throw new Error(`VOICEVOX synthesis returned ${audioResponse.status}`);
    const audio = Buffer.from(await audioResponse.arrayBuffer()).toString('base64');
    return { script, audio };
}
