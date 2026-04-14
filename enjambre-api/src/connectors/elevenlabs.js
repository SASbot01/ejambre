// ============================================
// Conector: ElevenLabs Text-to-Speech
// ============================================

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID_ALEX || '';

export function isElevenLabsConfigured() {
  return !!process.env.ELEVENLABS_API_KEY;
}

export function getDefaultVoiceId() {
  return DEFAULT_VOICE_ID;
}

/**
 * Convert text to speech via ElevenLabs.
 * Returns an MP3 Buffer. WhatsApp web voice notes accept MP3.
 */
export async function textToSpeech(text, voiceId = DEFAULT_VOICE_ID, { model = DEFAULT_MODEL } = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY no configurada');
  if (!voiceId) throw new Error('voiceId requerido (configura ELEVENLABS_VOICE_ID_ALEX)');
  if (!text || !text.trim()) throw new Error('Texto vacío');

  const url = `${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 200)}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}
