import { runExclusive } from "../runtime/modelRuntime";

// Kokoro-82M neural TTS (kokoro-js → transformers.js). OPT-IN: it never loads
// until the user downloads it in Settings — loading an 82M model unprompted can
// crash memory-constrained devices (iOS). When enabled it renders to a WAV blob
// played via HTMLAudio (independent of the suspended Tone context), and rendering
// is serialized through the shared runtime mutex so it never collides with the
// LLM. Falls back to Web Speech everywhere it isn't ready.

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = "af_heart";
const ENABLED_KEY = "ambientfm-kokoro-enabled";

export type KokoroStatus = "idle" | "loading" | "ready" | "error";

type KokoroModel = { generate: (t: string, o: { voice: string }) => Promise<{ toBlob: () => Blob }> };
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

// iOS Safari WebGPU is fragile and memory-limited; prefer WASM there (and
// wherever WebGPU is absent). Desktop with WebGPU gets the faster fp32 path.
function detectDevice(): "webgpu" | "wasm" {
  if (typeof navigator === "undefined") return "wasm";
  const ua = navigator.userAgent || "";
  const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  const hasGpu = !!(navigator as unknown as { gpu?: unknown }).gpu;
  return hasGpu && !iOS ? "webgpu" : "wasm";
}

export async function loadKokoro(onProgress?: (p: number, text: string) => void): Promise<boolean> {
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

// Warm the model in the background, only if the user has enabled the voice.
export function preloadKokoro(): void {
  if (kokoroEnabled() && status === "idle") void loadKokoro();
}

// Render text → object URL of a WAV blob, or null if Kokoro isn't ready. Does
// NOT trigger a load (that's explicit, via Settings/preload) so a live line
// never blocks on a big download — callers fall back to Web Speech meanwhile.
export async function kokoroRender(text: string): Promise<string | null> {
  if (!kokoroEnabled() || !kokoroReady() || !model || !text.trim()) return null;
  try {
    const audio = await runExclusive("tts", () => model!.generate(text, { voice: VOICE }));
    return URL.createObjectURL(audio.toBlob());
  } catch (e) {
    console.warn("Kokoro render failed", e);
    return null;
  }
}

// Drop the model + best-effort clear its cached weights.
export async function clearKokoro(): Promise<void> {
  model = null;
  status = "idle";
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => /transformers|kokoro|onnx/i.test(k)).map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
}

let el: HTMLAudioElement | null = null;
let url: string | null = null;

export function kokoroPlay(clipUrl: string): Promise<void> {
  stopKokoro();
  url = clipUrl;
  return new Promise((resolve) => {
    const a = new Audio(clipUrl);
    el = a;
    const done = () => { stopKokoro(); resolve(); };
    a.onended = done;
    a.onerror = done;
    void a.play().catch(done);
  });
}

export function stopKokoro(): void {
  try { el?.pause(); } catch { /* ignore */ }
  el = null;
  if (url) { URL.revokeObjectURL(url); url = null; }
}
