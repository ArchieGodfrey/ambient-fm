import { runExclusive } from "../runtime/modelRuntime";
import { getStation } from "../config/station";

// The voice plays on its OWN AudioContext, not Tone's shared one. Offline track/
// bed renders transiently swap Tone's global context to an OfflineContext; keeping
// the voice on a separate context means it can decode + play during a render (to
// cover the generation gap) without ever reading the offline context.
let voiceCtx: AudioContext | null = null;
function getVoiceCtx(): AudioContext {
  if (!voiceCtx) voiceCtx = new AudioContext();
  return voiceCtx;
}

// The DJ voice, via Piper (VITS) running fully on-device in WASM/CPU — no WebGPU,
// so it doesn't contend with WebLLM, and it's light enough (~75MB, <100MB RAM) to
// run on iPhone Safari where Kokoro's transformers.js stack crashed. The model
// downloads once (cached in OPFS) then works offline. Rendered WAV is decoded and
// played through the (gesture-unlocked) WebAudio context, straight to the
// hardware destination so the voice sits above the ducked music.

// The active voice comes from the station config (Settings / wizard picker).
const currentVoiceId = () => getStation().voiceId;
const ENABLED_KEY = "ambientfm-voice-enabled";
const INSTALLED_KEY = "ambientfm-voice-installed";
const AUTOTRIED_KEY = "ambientfm-voice-autotried"; // first-tune-in auto-download attempted

export type VoiceStatus = "idle" | "loading" | "ready" | "error";

let status: VoiceStatus = "idle";
let loadPromise: Promise<boolean> | null = null;

export function voiceEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === "1"; } catch { return false; }
}
export function setVoiceEnabled(v: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}
export function voiceStatus(): VoiceStatus { return status; }
export function voiceReady(): boolean { return status === "ready"; }
export function voiceInstalled(): boolean {
  try { return localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return false; }
}
export function voiceSupported(): boolean { return true; } // Piper runs everywhere (WASM/CPU)

// Full error detail for the debug log (name/message/first stack frames).
function errStr(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}${e.stack ? ` | ${e.stack.split("\n").slice(1, 3).join(" ")}` : ""}`;
  try { return JSON.stringify(e); } catch { return String(e); }
}

type Session = { predict: (text: string) => Promise<Blob> };
let session: Session | null = null;
let loadedVoiceId: string | null = null;

// Use the MAIN-THREAD TtsSession — the worker-based predict() throws "error
// importing a module script" in Vite dev (a dependency's module-worker can't
// resolve its bare imports). Main-thread ORT imports ARE rewritten by Vite.
// pipe library logs to console (captured by the debug panel) for diagnosis.
async function ensureSession(onProgress?: (p: number, text: string) => void): Promise<Session> {
  const voiceId = currentVoiceId();
  if (session && loadedVoiceId === voiceId) return session;
  session = null; // voice changed → rebuild for the new voice
  const mod = await import("@mintplex-labs/piper-tts-web");
  session = (await mod.TtsSession.create({
    voiceId,
    logger: (text: string) => console.warn("[piper]", text),
    progress: (p: { url: string; total: number; loaded: number }) => {
      if (p?.total > 0) onProgress?.(Math.min(1, p.loaded / p.total), `${Math.round((p.loaded / p.total) * 100)}%`);
    },
  })) as unknown as Session;
  loadedVoiceId = voiceId;
  return session;
}

// Prepare (download + init) the voice. Reports 0..1 progress.
export function loadVoice(onProgress?: (p: number, text: string) => void): Promise<boolean> {
  if (voiceReady()) return Promise.resolve(true);
  if (loadPromise) return loadPromise;
  status = "loading";
  loadPromise = (async () => {
    try {
      await ensureSession(onProgress);
      status = "ready";
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ }
      return true;
    } catch (e) {
      console.warn("Voice load failed:", errStr(e));
      status = "error";
      session = null;
      return false;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

function autoTried(): boolean {
  try { return localStorage.getItem(AUTOTRIED_KEY) === "1"; } catch { return false; }
}
function markAutoTried(): void {
  try { localStorage.setItem(AUTOTRIED_KEY, "1"); } catch { /* ignore */ }
}

// Called on tune-in: warm the cached voice, or — the FIRST time only —
// auto-download it alongside the composer model. A prior Remove is respected
// (autoTried stays set) so we never re-download against the user's wishes.
export function maybeAutoLoadVoice(): void {
  if (voiceReady() || status === "loading") return;
  if (voiceInstalled()) { void loadVoice(); return; } // warm the cached model
  if (autoTried()) return;                             // user removed it before
  markAutoTried();
  setVoiceEnabled(true);
  void loadVoice();
}

// Render text → a decoded AudioBuffer, or null if unavailable. Serialized through
// the shared mutex so it can't peak alongside an LLM op.
export async function voiceRender(text: string): Promise<AudioBuffer | null> {
  if (!voiceEnabled() || !text.trim()) return null;
  try {
    const s = await ensureSession();
    const blob = await runExclusive("tts", () => s.predict(text));
    status = "ready";
    try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ }
    return await getVoiceCtx().decodeAudioData(await blob.arrayBuffer());
  } catch (e) {
    console.warn("Voice render failed:", errStr(e));
    return null;
  }
}

let current: AudioBufferSourceNode | null = null;

export function voicePlay(buffer: AudioBuffer): Promise<void> {
  stopVoice();
  return new Promise((resolve) => {
    try {
      const ctx = getVoiceCtx();
      void ctx.resume?.();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => { current = null; resolve(); };
      current = src;
      src.start();
    } catch (e) {
      console.warn("Voice playback failed", e);
      resolve();
    }
  });
}

export function stopVoice(): void {
  try { current?.stop(); } catch { /* already stopped */ }
  current = null;
}

export async function clearVoice(): Promise<void> {
  status = "idle";
  session = null;
  loadedVoiceId = null;
  const voiceId = currentVoiceId();
  try { localStorage.removeItem(INSTALLED_KEY); localStorage.setItem(AUTOTRIED_KEY, "1"); } catch { /* ignore */ }
  try {
    const { remove } = await import("@mintplex-labs/piper-tts-web");
    await remove(voiceId);
  } catch { /* ignore */ }
}

// Drop the in-memory session/status so the next load picks up a newly-selected
// voice (the config's voiceId). Used by the voice picker.
export function resetVoiceSession(): void {
  session = null;
  loadedVoiceId = null;
  loadPromise = null;
  status = "idle";
  try { localStorage.removeItem(INSTALLED_KEY); } catch { /* ignore */ }
}

// Create + resume the voice's own AudioContext inside a user gesture (tune-in tap)
// so it's allowed to produce sound later.
export function unlockVoice(): void {
  try { void getVoiceCtx().resume?.(); } catch { /* ignore */ }
}
