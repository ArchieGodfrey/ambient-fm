import { db } from '../../db/db';
import { getPiperSynth } from './piperSynth';
import type { CompositionPlan } from '../../ai/types';
import { getSingingParams } from './musicTheory';
import type { SingingParams } from './musicTheory';
import { postToast } from '../../utils/toast';

export type VocalSynthStage = 'idle' | 'loading' | 'ready' | 'error' | 'synthesizing';

export type VocalSynthStatus = {
  stage: VocalSynthStage;
  progress?: number;
  text?: string;
  error?: string;
};

function dispatch(detail: VocalSynthStatus) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vocal-synth-status', { detail }));
  }
}

type RawAudio = { audio: Float32Array; sampleRate: number };
type PendingEntry = { cacheKey: string; resolve: (raw: RawAudio) => void; reject: (err: Error) => void };

export class VocalSynth {
  private worker: Worker | null = null;
  private rawCache = new Map<string, RawAudio>();
  private pending = new Map<string, PendingEntry>();
  private loadPromise: Promise<void> | null = null;
  private _stage: VocalSynthStage = 'idle';

  get stage() { return this._stage; }
  get isReady() { return this._stage === 'ready'; }

  private doLoad(): Promise<void> {
    this._stage = 'loading';
    dispatch({ stage: 'loading', text: 'Starting Kokoro TTS model…' });

    return new Promise<void>((resolve, reject) => {
      this.worker = new Worker(new URL('./vocalWorker.ts', import.meta.url), { type: 'module' });

      this.worker.onmessage = ({ data }: MessageEvent) => {
        const msg = data as Record<string, unknown>;

        if (msg.type === 'ready') {
          this._stage = 'ready';
          dispatch({ stage: 'ready', text: 'Kokoro TTS ready' });
          resolve();
        }

        if (msg.type === 'error') {
          const errMsg = String(msg.error);
          this._stage = 'error';
          dispatch({ stage: 'error', text: errMsg, error: errMsg });
          postToast(`Kokoro failed to load: ${errMsg.split('\n')[0]}`, 'error');
          reject(new Error(errMsg));
        }

        if (msg.type === 'progress') {
          const total = typeof msg.total === 'number' ? msg.total : 0;
          const loaded = typeof msg.loaded === 'number' ? msg.loaded : 0;
          const progress = total > 0 ? loaded / total : undefined;
          const text = String(msg.file ?? msg.name ?? '');
          const isDownloading = Boolean(msg.isDownloading);
          const label = isDownloading ? `Downloading ${text || ''}` : text ? `Loading ${text}` : 'Loading…';
          dispatch({ stage: 'loading', progress, text: label.trim() });
        }

        if (msg.type === 'status') {
          dispatch({ stage: 'loading', text: String(msg.text ?? '') });
        }



        if (msg.type === 'device-info') {
          dispatch({ stage: 'loading', text: `GPU: ${msg.vendor} ${msg.arch}` });
        }

        if (msg.type === 'shader-progress') {
          const compiled = Number(msg.compiled ?? 0);
          const method   = String(msg.method ?? 'pipeline');
          dispatch({ stage: 'synthesizing', text: `GPU shaders: ${compiled} (${method})` });
          if (compiled === 1) {
            postToast(`GPU shader compiled via ${method}`, 'info');
          }
        }

        if (msg.type === 'gpu-dispatch') {
          const count = Number(msg.count ?? 0);
          if (count === 1) {
            postToast('✓ GPU compute confirmed — ORT is dispatching workgroups', 'success');
          }
          dispatch({ stage: 'synthesizing', text: `GPU dispatches: ${count}` });
        }

        if (msg.type === 'synth-start' && typeof msg.id === 'string') {
          const sab = Boolean(msg.sharedArrayBuffer);
          const threads = Number(msg.threads ?? 1);
          const mode = sab ? `${threads} threads` : '1 thread (no SharedArrayBuffer)';
          dispatch({ stage: 'synthesizing', text: `Synthesising · CPU · ${mode}` });
        }

        if (msg.type === 'synth-heartbeat' && typeof msg.id === 'string') {
          const elapsed = Number(msg.elapsed ?? 0);
          dispatch({ stage: 'synthesizing', text: `Synthesising… ${elapsed}s` });

        }



        if (msg.type === 'synth-result' && typeof msg.id === 'string') {
          const entry = this.pending.get(msg.id);
          if (entry) {
            const raw: RawAudio = { audio: msg.audio as Float32Array, sampleRate: msg.sampleRate as number };
            this.rawCache.set(entry.cacheKey, raw);
            // Persist to IndexedDB for cross-session cache
            db.vocalAudio.put({
              key: entry.cacheKey,
              audio: raw.audio,
              sampleRate: raw.sampleRate,
              timestamp: Date.now(),
            }).catch(() => {});
            entry.resolve(raw);
            this.pending.delete(msg.id);
          }
          if (this.pending.size === 0 && this._stage === 'synthesizing') {
            this._stage = 'ready';
            dispatch({ stage: 'ready', text: 'Kokoro TTS ready' });
          }
        }

        if (msg.type === 'synth-error' && typeof msg.id === 'string') {
          const entry = this.pending.get(msg.id);
          const errMsg = String(msg.error);
          if (entry) {
            entry.reject(new Error(errMsg));
            this.pending.delete(msg.id);
          }
          dispatch({ stage: 'error', text: errMsg, error: errMsg });
          postToast(`Vocal synthesis error: ${errMsg}`, 'error');
        }
      };

      this.worker.onerror = (event) => {
        const errMsg = `Vocal worker error: ${event.message}`;
        this._stage = 'error';
        dispatch({ stage: 'error', text: errMsg, error: errMsg });
        const err = new Error(errMsg);
        reject(err);
        for (const entry of this.pending.values()) entry.reject(err);
        this.pending.clear();
      };

      this.worker.postMessage({ type: 'load', origin: typeof window !== 'undefined' ? window.location.origin : '' });
    });
  }

  async load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.doLoad().catch((err) => {
        this.loadPromise = null;
        this.worker?.terminate();
        this.worker = null;
        throw err;
      });
    }
    return this.loadPromise;
  }

  private cacheKey(text: string, voice: string, singingParams?: SingingParams) {
    const prefix = singingParams ? `${Math.round(singingParams.rootHz)}hz:` : '';
    return `${voice}:${prefix}${text}`;
  }

  async synthesize(text: string, voice = 'af_sky', singingParams?: SingingParams): Promise<RawAudio> {
    // Route Piper voices to the dedicated Piper engine (no singing processing)
    if (voice.startsWith('piper_')) {
      return getPiperSynth().synthesize(text, voice);
    }
    const key = this.cacheKey(text, voice, singingParams);

    // 1. Memory cache
    if (this.rawCache.has(key)) return this.rawCache.get(key)!;

    // 2. IndexedDB persistent cache
    try {
      const stored = await db.vocalAudio.get(key);
      if (stored) {
        const raw: RawAudio = {
          audio: stored.audio instanceof Float32Array
            ? stored.audio
            : new Float32Array(stored.audio as unknown as ArrayBuffer),
          sampleRate: stored.sampleRate,
        };
        this.rawCache.set(key, raw);
        return raw;
      }
    } catch {}

    // 3. Synthesise via browser worker
    await this.load();
    this._stage = 'synthesizing';
    dispatch({ stage: 'synthesizing', text: `Synthesising vocals…` });

    const id = crypto.randomUUID();
    return new Promise<RawAudio>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          const msg = 'Synthesis timed out after 10 min. WebGPU detected but shaders may have failed to compile. Try unloading Kokoro in Settings and reloading.';
          postToast(msg, 'error');
          reject(new Error(msg));
        }
      }, 600_000); // 10 min — first WebGPU run compiles shaders
      this.pending.set(id, {
        cacheKey: key,
        resolve: (raw) => { clearTimeout(timeoutId); resolve(raw); },
        reject: (err) => { clearTimeout(timeoutId); reject(err); },
      });
      this.worker!.postMessage({ type: 'synth', id, text, voice, singingParams });
    });
  }

  clearMemoryCache() { this.rawCache.clear(); }


  getCachedRaw(text: string, voice = 'af_sky', singingParams?: SingingParams): RawAudio | null {
    if (voice.startsWith('piper_')) {
      return getPiperSynth().getCachedRaw(text, voice);
    }
    return this.rawCache.get(this.cacheKey(text, voice, singingParams)) ?? null;
  }

  /** Warm the memory cache from IndexedDB using plan+singingParams so cache keys match */
  async warmCache(plan: CompositionPlan, voice: string): Promise<void> {
    await Promise.all(plan.sections.map(async (section) => {
      const text = section.lyricLine;
      if (!text) return;
      const singingParams = getSingingParams(plan, section);
      const key = this.cacheKey(text, voice, singingParams);
      if (this.rawCache.has(key)) return;
      try {
        const stored = await db.vocalAudio.get(key);
        if (stored) {
          this.rawCache.set(key, {
            audio: stored.audio instanceof Float32Array
              ? stored.audio
              : new Float32Array(stored.audio as unknown as ArrayBuffer),
            sampleRate: stored.sampleRate,
          });
        }
      } catch {}
    }));
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.loadPromise = null;
    this._stage = 'idle';
    this.rawCache.clear();
    for (const entry of this.pending.values()) {
      entry.reject(new Error('VocalSynth destroyed'));
    }
    this.pending.clear();
    dispatch({ stage: 'idle' });
  }
}

let instance: VocalSynth | null = null;

export function getVocalSynth(): VocalSynth {
  if (!instance) instance = new VocalSynth();
  return instance;
}
