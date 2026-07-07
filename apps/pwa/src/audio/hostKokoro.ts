// Kokoro-82M neural TTS (via kokoro-js → transformers.js, WebGPU/WASM) for a
// nicer DJ voice than the platform speechSynthesis. Lazy-loaded on first use so
// a missing/failed model never blocks app start, and it renders to a WAV blob
// played through an HTMLAudioElement — independent of the Tone audio context
// (which suspends during inference), so the voice survives the generation gap.
//
// Note: rendering uses the GPU, so callers render BEFORE kicking off track
// generation (which also wants the GPU), then play the pre-rendered clip while
// the track composes. See useRadio.

let ttsPromise: Promise<unknown> | null = null;
let unavailable = false;

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = "af_heart"; // warm, natural female voice

async function getTTS(): Promise<{ generate: (t: string, o: { voice: string }) => Promise<{ toBlob: () => Blob }> } | null> {
  if (unavailable) return null;
  if (!ttsPromise) {
    ttsPromise = (async () => {
      const mod = await import("kokoro-js");
      const device = typeof navigator !== "undefined" && (navigator as unknown as { gpu?: unknown }).gpu ? "webgpu" : "wasm";
      return mod.KokoroTTS.from_pretrained(MODEL, { dtype: device === "webgpu" ? "fp32" : "q8", device });
    })().catch((e) => {
      console.warn("Kokoro TTS unavailable — falling back to speechSynthesis", e);
      unavailable = true;
      return null;
    });
  }
  return ttsPromise as Promise<{ generate: (t: string, o: { voice: string }) => Promise<{ toBlob: () => Blob }> } | null>;
}

// Warm the model in the background (e.g. once the station is tuned in).
export function preloadKokoro(): void {
  void getTTS();
}

// Synthesize text → object URL of a WAV blob, or null if Kokoro isn't usable.
export async function kokoroRender(text: string): Promise<string | null> {
  const tts = await getTTS();
  if (!tts || !text.trim()) return null;
  try {
    const audio = await tts.generate(text, { voice: VOICE });
    return URL.createObjectURL(audio.toBlob());
  } catch (e) {
    console.warn("Kokoro render failed", e);
    return null;
  }
}

let el: HTMLAudioElement | null = null;
let url: string | null = null;

// Play a rendered clip (revokes the URL when done). Resolves when playback ends.
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
