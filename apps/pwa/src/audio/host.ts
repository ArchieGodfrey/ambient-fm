// The DJ host voice, via the Web Speech API. Crucially, speechSynthesis is
// INDEPENDENT of the Web Audio context, so it keeps talking while inference
// suspends the Tone audio (see RuntimeKernel) — the voice is what covers the
// generation gap between tracks. Feature-detected; a graceful no-op when absent.

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

// Speak a line and resolve when it finishes. Resolves immediately if TTS is
// unavailable. A timeout backstops engines that never fire `onend`.
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
      // Backstop: some engines drop onend; cap by a rough spoken-duration estimate.
      window.setTimeout(finish, Math.min(22000, 1400 + text.length * 75));
    } catch {
      finish();
    }
  });
}

export function cancelHost(): void {
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}
