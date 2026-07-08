// While a track renders offline (Tone.Offline), Tone's GLOBAL context is
// temporarily an OfflineAudioContext. Anything that reads Tone.getContext() to
// start LIVE playback during that window (the DJ voice, the disc SFX) would grab
// the offline context and play into the render instead of the speakers. This gate
// marks the render window so those callers can wait for it (voice) or skip (SFX).

let gate: Promise<void> | null = null;
let release: (() => void) | null = null;

export function beginRender() {
  // Renders are serialized (one at a time), so a single gate promise is enough.
  gate = new Promise<void>((resolve) => { release = resolve; });
}

export function endRender() {
  release?.();
  gate = null;
  release = null;
}

export function isRendering(): boolean {
  return gate !== null;
}

// Resolves immediately when no render is in flight, otherwise when it finishes.
export function whenRenderIdle(): Promise<void> {
  return gate ?? Promise.resolve();
}
