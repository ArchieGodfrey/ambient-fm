import { PiperWebEngine, OnnxWebRuntime, PhonemizeWebRuntime } from 'piper-tts-web';

// Map short IDs to HuggingFace voice names
const VOICE_MAP: Record<string, { voice: string; speaker: number }> = {
  piper_lessac: { voice: 'en_US-lessac-medium', speaker: 0 },
  piper_ryan:   { voice: 'en_US-ryan-medium', speaker: 0 },
  piper_amy:    { voice: 'en_US-amy-medium', speaker: 0 },
};

/** Parse 16-bit PCM WAV Blob → Float32Array without AudioContext (not available in workers) */
async function wavToFloat32(blob: Blob): Promise<{ audio: Float32Array; sampleRate: number }> {
  const buf = await blob.arrayBuffer();
  const view = new DataView(buf);
  const sampleRate = view.getUint32(24, true);
  // Find 'data' chunk (some WAVs have extra chunks before data)
  let offset = 12;
  while (offset < buf.byteLength - 8) {
    const id = String.fromCharCode(...[0,1,2,3].map(i => view.getUint8(offset + i)));
    const size = view.getUint32(offset + 4, true);
    if (id === 'data') { offset += 8; break; }
    offset += 8 + size;
  }
  const samples = (buf.byteLength - offset) / 2;
  const audio = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    audio[i] = view.getInt16(offset + i * 2, true) / 32768.0;
  }
  return { audio, sampleRate };
}

let engine: InstanceType<typeof PiperWebEngine> | null = null;

self.onmessage = async ({ data }: MessageEvent) => {
  const { type } = data as { type: string };

  if (type === 'load') {
    const { origin } = data as { origin?: string };
    try {
      // Use HF proxy for voice model downloads — needed because COEP: require-corp
      // requires cross-origin resources to have CORP headers, which HF CDN lacks
      const piperFetch = async (url: string) => {
        const hfProxy = origin ? `${origin}/hf-proxy` : '/hf-proxy';
        const proxied = url.replace('https://huggingface.co', hfProxy);
        const res = await fetch(proxied);
        if (!res.ok) throw new Error(`Failed to download: ${url} (${res.status})`);
        return res;
      };

      engine = new PiperWebEngine({
        onnxRuntime: new OnnxWebRuntime({ basePath: '/ort/' }),
        phonemizeRuntime: new PhonemizeWebRuntime({ basePath: '/piper/' }),
  
        voiceProvider: { fetch: piperFetch },
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
    return;
  }

  if (type === 'synth') {
    const { id, text, voiceId } = data as { id: string; text: string; voiceId: string };
    if (!engine) { self.postMessage({ type: 'synth-error', id, error: 'Piper not loaded' }); return; }
    const config = VOICE_MAP[voiceId];
    if (!config) { self.postMessage({ type: 'synth-error', id, error: `Unknown Piper voice: ${voiceId}` }); return; }

    self.postMessage({ type: 'synth-start', id });
    const t0 = Date.now();
    try {
      const response = await engine.generate(text, config.voice, config.speaker);
      const { audio, sampleRate } = await wavToFloat32(response.file);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      (self as any).postMessage(
        { type: 'synth-result', id, audio, sampleRate, elapsed },
        [audio.buffer],
      );
    } catch (err) {
      self.postMessage({ type: 'synth-error', id, error: String(err) });
    }
  }
};
