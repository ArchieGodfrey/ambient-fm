import { voiceRender, voicePlay, stopVoice, maybeAutoLoadVoice, unlockVoice, voiceEnabled } from "./hostPiper";
import { whenRenderIdle } from "./renderGate";

// The DJ host voice: Piper neural TTS, on-device. We deliberately do NOT fall
// back to the platform Web Speech voice (too disruptive / inconsistent) — when
// the neural voice isn't available, the line simply shows as an on-screen
// caption (subtitles) for a readable beat, with no audio.

export { maybeAutoLoadVoice, unlockVoice };

// Whether the DJ can be heard right now (else it's captions-only).
export function voiceAudible(): boolean {
  return voiceEnabled();
}

const paceMs = (text: string) => Math.min(7000, Math.max(1600, 1200 + text.length * 45));

// Prepare a line: render Piper now; return a player that plays the audio, or —
// when the neural voice isn't available — paces for a readable caption duration
// (the caller shows the caption regardless).
export async function prepareLine(text: string): Promise<() => Promise<void>> {
  if (!text.trim()) return () => Promise.resolve();
  // A track render transiently owns the global audio context; decode + play the
  // voice on the live context by waiting for any render to finish first.
  await whenRenderIdle();
  const buffer = await voiceRender(text);
  if (buffer) return async () => { await whenRenderIdle(); await voicePlay(buffer); };
  return () => new Promise<void>((resolve) => window.setTimeout(resolve, paceMs(text)));
}

export function cancelHost(): void {
  stopVoice();
}
