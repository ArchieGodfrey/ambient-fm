import * as Tone from "tone";
import { runExclusive } from "../runtime/modelRuntime";

// Kokoro-82M neural TTS (kokoro-js → transformers.js). OPT-IN and DESKTOP-ONLY:
// its onnxruntime/WASM stack throws "undefined is not a function" and blows past
// memory on iOS Safari, so we don't load it there — the station uses the system
// speechSynthesis voice on iOS instead. Rendered PCM plays through the
// (already-unlocked) WebAudio context via a BufferSource straight to the hardware
// destination (bypasses the duck so the voice sits on top). Serialized through
// the shared runtime mutex; falls back to Web Speech whenever it isn't ready.

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = "af_heart";
const ENABLED_KEY = "ambientfm-kokoro-enabled";
const INSTALLED_KEY = "ambientfm-kokoro-installed"; // weights cached (persists across reloads)

export type KokoroStatus = "idle" | "loading" | "ready" | "error";
export type Clip = { samples: Float32Array; rate: number };

type RawAudio = { toBlob: () => Blob; audio: Float32Array; sampling_rate: number };
type KokoroModel = { generate: (t: string, o: { voice: string }) => Promise<RawAudio> };
let model: KokoroModel | null = null;
let status: KokoroStatus = "idle";
let loadPromise: Promise<boolean> | null = null;

export function kokoroEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === "1"; } catch { return false; }
}
export function setKokoroEnabled(v: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}
export function kokoroStatus(): KokoroStatus { return status; }
export function kokoroReady(): boolean { return status === "ready" && !!model; }
// Whether the weights have been downloaded before (cached in IndexedDB). Survives
// reloads, unlike the in-memory `status`.
export function kokoroInstalled(): boolean {
  try { return localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return false; }
}

// iOS (incl. iPadOS reporting as Mac): Kokoro's ML stack crashes/OOMs, so it's
// unsupported there.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const nav = navigator as unknown as { platform?: string; maxTouchPoints?: number };
  return /iP(hone|ad|od)/.test(ua) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
}
export function kokoroSupported(): boolean { return !isIOS(); }

function detectDevice(): "webgpu" | "wasm" {
  const hasGpu = typeof navigator !== "undefined" && !!(navigator as unknown as { gpu?: unknown }).gpu;
  return hasGpu ? "webgpu" : "wasm";
}

export async function loadKokoro(onProgress?: (p: number, text: string) => void): Promise<boolean> {
  if (!kokoroSupported()) { status = "error"; return false; } // iOS: never touch the ML stack
  if (kokoroReady()) return true;
  if (loadPromise) return loadPromise;
  status = "loading";
  loadPromise = (async () => {
    try {
      const mod = await import("kokoro-js");
      const device = detectDevice();
      const opts = {
        dtype: device === "webgpu" ? "fp32" : "q8",
        device,
        progress_callback: (info: { status?: string; file?: string; progress?: number }) => {
          if (info?.status === "progress" && typeof info.progress === "number") onProgress?.(Math.min(1, info.progress / 100), `${info.file ?? "model"} · ${Math.round(info.progress)}%`);
          else if (info?.status) onProgress?.(0, String(info.status));
        },
      } as unknown as Parameters<typeof mod.KokoroTTS.from_pretrained>[1];
      model = (await mod.KokoroTTS.from_pretrained(MODEL, opts)) as unknown as KokoroModel;
      status = "ready";
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ }
      return true;
    } catch (e) {
      console.warn("Kokoro load failed — using speechSynthesis", e);
      status = "error";
      model = null;
      return false;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

// Warm the model in the background, only if enabled and supported (not iOS).
export function preloadKokoro(): void {
  if (kokoroSupported() && kokoroEnabled() && status === "idle") void loadKokoro();
}

// Render text → object URL of a WAV blob, or null if Kokoro isn't ready. Does
// NOT trigger a load (that's explicit, via Settings/preload) so a live line
// never blocks on a big download — callers fall back to Web Speech meanwhile.
export async function kokoroRender(text: string): Promise<Clip | null> {
  if (!kokoroEnabled() || !kokoroReady() || !model || !text.trim()) return null;
  try {
    const audio = await runExclusive("tts", () => model!.generate(text, { voice: VOICE }));
    return { samples: audio.audio, rate: audio.sampling_rate };
  } catch (e) {
    console.warn("Kokoro render failed", e);
    return null;
  }
}

// Drop the model + best-effort clear its cached weights.
export async function clearKokoro(): Promise<void> {
  model = null;
  status = "idle";
  try { localStorage.removeItem(INSTALLED_KEY); } catch { /* ignore */ }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => /transformers|kokoro|onnx/i.test(k)).map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
}

// Kept for call-site compatibility; WebAudio unlock is handled by unlockAudio()
// (Tone.start) in the same gesture, so nothing extra is needed here.
export function unlockVoice(): void { /* no-op */ }

let current: AudioBufferSourceNode | null = null;

// Play rendered PCM through the WebAudio context, straight to the hardware
// destination (bypasses the duck so the voice sits above the bed). The context
// is unlocked by unlockAudio() in the tune-in/test gesture, so this works on iOS.
export function kokoroPlay(clip: Clip): Promise<void> {
  stopKokoro();
  return new Promise((resolve) => {
    try {
      const ctx = Tone.getContext().rawContext as unknown as AudioContext;
      void ctx.resume?.();
      const buf = ctx.createBuffer(1, clip.samples.length, clip.rate);
      buf.getChannelData(0).set(clip.samples);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => { current = null; resolve(); };
      current = src;
      src.start();
    } catch (e) {
      console.warn("Kokoro playback failed", e);
      resolve();
    }
  });
}

export function stopKokoro(): void {
  try { current?.stop(); } catch { /* already stopped */ }
  current = null;
}
