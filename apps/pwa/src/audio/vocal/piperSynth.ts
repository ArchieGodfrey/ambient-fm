import { db } from '../../db/db';

type RawAudio = { audio: Float32Array; sampleRate: number };
type PendingEntry = { cacheKey: string; resolve: (r: RawAudio) => void; reject: (e: Error) => void };

export class PiperSynth {
  private worker: Worker | null = null;
  private rawCache = new Map<string, RawAudio>();
  private pending = new Map<string, PendingEntry>();
  private loadPromise: Promise<void> | null = null;
  private _ready = false;

  get isReady() { return this._ready; }

  async load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = new Promise<void>((resolve, reject) => {
        this.worker = new Worker(new URL('./piperWorker.ts', import.meta.url), { type: 'module' });

        this.worker.onmessage = ({ data }: MessageEvent) => {
          const msg = data as Record<string, unknown>;
          if (msg.type === 'ready') { this._ready = true; resolve(); }
          if (msg.type === 'error') { reject(new Error(String(msg.error))); }
          if (msg.type === 'synth-result' && typeof msg.id === 'string') {
            const entry = this.pending.get(msg.id);
            if (entry) {
              const raw: RawAudio = { audio: msg.audio as Float32Array, sampleRate: msg.sampleRate as number };
              this.rawCache.set(entry.cacheKey, raw);
              db.vocalAudio.put({ key: entry.cacheKey, audio: raw.audio, sampleRate: raw.sampleRate, timestamp: Date.now() }).catch(() => {});
              entry.resolve(raw);
              this.pending.delete(msg.id);
            }
          }
          if (msg.type === 'synth-error' && typeof msg.id === 'string') {
            const entry = this.pending.get(msg.id);
            if (entry) { entry.reject(new Error(String(msg.error))); this.pending.delete(msg.id); }
          }
        };
        this.worker.onerror = (e) => reject(new Error(`Piper worker: ${e.message}`));
        this.worker.postMessage({ type: 'load', origin: typeof window !== 'undefined' ? window.location.origin : '' });
      }).catch(err => { this.loadPromise = null; this.worker?.terminate(); this.worker = null; throw err; });
    }
    return this.loadPromise;
  }

  private cacheKey(text: string, voiceId: string) {
    return `${voiceId}:${text}`;
  }

  async synthesize(text: string, voiceId: string): Promise<RawAudio> {
    const key = this.cacheKey(text, voiceId);
    if (this.rawCache.has(key)) return this.rawCache.get(key)!;

    try {
      const stored = await db.vocalAudio.get(key);
      if (stored) {
        const raw = { audio: stored.audio instanceof Float32Array ? stored.audio : new Float32Array(stored.audio as unknown as ArrayBuffer), sampleRate: stored.sampleRate };
        this.rawCache.set(key, raw);
        return raw;
      }
    } catch {}

    await this.load();
    const id = crypto.randomUUID();
    return new Promise<RawAudio>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Piper synthesis timed out'));
        }
      }, 120_000);
      this.pending.set(id, {
        cacheKey: key,
        resolve: (r) => { clearTimeout(timeout); resolve(r); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });
      this.worker!.postMessage({ type: 'synth', id, text, voiceId });
    });
  }

  getCachedRaw(text: string, voiceId: string): RawAudio | null {
    return this.rawCache.get(this.cacheKey(text, voiceId)) ?? null;
  }

  clearMemoryCache() { this.rawCache.clear(); }

  async warmCache(sections: Array<{ lyricLine?: string }>, voiceId: string): Promise<void> {
    await Promise.all(sections.map(async s => {
      if (!s.lyricLine) return;
      const key = this.cacheKey(s.lyricLine, voiceId);
      if (this.rawCache.has(key)) return;
      try {
        const stored = await db.vocalAudio.get(key);
        if (stored) this.rawCache.set(key, { audio: stored.audio instanceof Float32Array ? stored.audio : new Float32Array(stored.audio as unknown as ArrayBuffer), sampleRate: stored.sampleRate });
      } catch {}
    }));
  }

  destroy() {
    this.worker?.terminate(); this.worker = null;
    this.loadPromise = null; this._ready = false;
    this.rawCache.clear();
    for (const e of this.pending.values()) e.reject(new Error('PiperSynth destroyed'));
    this.pending.clear();
  }
}

let instance: PiperSynth | null = null;
export function getPiperSynth(): PiperSynth {
  if (!instance) instance = new PiperSynth();
  return instance;
}
