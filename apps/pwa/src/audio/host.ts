import { kokoroRender, kokoroPlay, stopKokoro, preloadKokoro } from "./hostKokoro";

// The DJ host voice. Prefers Kokoro neural TTS (nicer voice); falls back to the
// platform Web Speech API. Both are independent of the Tone audio context (which
// suspends during inference), so the voice covers the track-generation gap.

export { preloadKokoro };

export function hostAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  try {
    const vs = window.speechSynthesis.getVoices();
    return (
      vs.find((v) => v.lang?.startsWith("en") && v.localService) ??
      vs.find((v) => v.lang?.startsWith("en")) ??
      vs[0]
    );
  } catch {
    return undefined;
  }
}

// Live speechSynthesis fallback. Resolves when the line finishes (with a
// timeout backstop for engines that drop onend).
export function speak(text: string, opts?: { rate?: number; pitch?: number }): Promise<void> {
  if (!hostAvailable() || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = opts?.rate ?? 0.98;
      u.pitch = opts?.pitch ?? 1;
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
      window.setTimeout(finish, Math.min(22000, 1400 + text.length * 75));
    } catch {
      finish();
    }
  });
}

// Prepare a line for playback and return a player that plays it and resolves
// when done. Kokoro is RENDERED here (uses the GPU) so the returned player just
// plays a pre-rendered clip via HTMLAudio — safe to run concurrently with track
// generation. If Kokoro is unavailable, the player speaks live via Web Speech.
export async function prepareLine(text: string): Promise<() => Promise<void>> {
  if (!text.trim()) return () => Promise.resolve();
  const clip = await kokoroRender(text);
  if (clip) return () => kokoroPlay(clip);
  return () => speak(text);
}

export function cancelHost(): void {
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  stopKokoro();
}
