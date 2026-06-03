import { KokoroTTS, type GenerateOptions } from 'kokoro-js';
import { env } from '@huggingface/transformers';
import { processForSinging } from './singingProcessor';
import type { SingingParams } from './musicTheory';

declare const __HF_TOKEN__: string;

type Voice = NonNullable<GenerateOptions['voice']>;

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

let tts: KokoroTTS | null = null;

async function hasLocalModel(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/models/${MODEL_ID}/resolve/main/config.json`);
    if (!res.ok) return false;
    return (await res.text()).trimStart().startsWith('{');
  } catch { return false; }
}

self.onmessage = async ({ data }: MessageEvent) => {
  const { type } = data as { type: string };

  if (type === 'load') {
    const { origin } = data as { origin: string };
    try {
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      const token: string = typeof __HF_TOKEN__ !== 'undefined' ? __HF_TOKEN__ : '';
      if (token) {
        const origFetch = globalThis.fetch.bind(globalThis);
        globalThis.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
          const url = String(input instanceof Request ? input.url : input);
          if (url.includes('huggingface.co') || url.includes('cdn-lfs')) {
            const headers = new Headers(init?.headers);
            headers.set('Authorization', `Bearer ${token}`);
            return origFetch(input, { ...init, headers });
          }
          return origFetch(input, init);
        };
        env.remoteHost = 'https://huggingface.co';
      } else {
        const local = await hasLocalModel(origin);
        env.remoteHost = local ? `${origin}/models` : `${origin}/hf-proxy`;
      }

      const sab = typeof SharedArrayBuffer !== 'undefined';
      const threads = sab
        ? Math.min((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4, 8)
        : 1;

      (env.backends.onnx as Record<string, unknown>).wasm = {
        ...(env.backends.onnx as Record<string, unknown>).wasm as object,
        numThreads: sab ? threads : 1,
        wasmPaths: '/ort/',
      };

      self.postMessage({ type: 'status', text: `Loading Kokoro (CPU · ${sab ? threads + ' threads' : '1 thread'})…` });

      tts = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'q4',
        progress_callback: (info: Record<string, unknown>) => {
          self.postMessage({ type: 'progress', ...info });
        },
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      self.postMessage({ type: 'error', error: msg });
    }
    return;
  }

  if (type === 'synth') {
    const { id, text, voice, singingParams } =
      data as { id: string; text: string; voice?: Voice; singingParams?: SingingParams };

    if (!tts) { self.postMessage({ type: 'synth-error', id, error: 'Model not loaded' }); return; }

    const sab = typeof SharedArrayBuffer !== 'undefined';
    const threads = sab
      ? Math.min((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4, 8)
      : 1;
    self.postMessage({ type: 'synth-start', id, threads, sharedArrayBuffer: sab });

    const t0 = Date.now();
    const ticker = setInterval(() => {
      self.postMessage({ type: 'synth-heartbeat', id, elapsed: Math.round((Date.now() - t0) / 1000) });
    }, 5_000);

    try {
      const output = await tts.generate(text, { voice: voice ?? 'af_sky' });
      let audio = output.audio instanceof Float32Array ? output.audio : new Float32Array(output.audio);
      const sampleRate: number = output.sampling_rate;

      // Phase 1: singing pipeline — pitch to key root + vibrato
      if (singingParams) {
        audio = processForSinging(audio, sampleRate, singingParams);
      }

      clearInterval(ticker);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      (self as any).postMessage(
        { type: 'synth-result', id, audio, sampleRate, elapsed },
        [audio.buffer],
      );
    } catch (err) {
      clearInterval(ticker);
      self.postMessage({ type: 'synth-error', id, error: String(err) });
    }
  }
};
