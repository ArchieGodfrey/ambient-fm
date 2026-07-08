// Offline renders (renderTrack, the DJ bed) each temporarily swap Tone's GLOBAL
// context to an OfflineAudioContext. Two overlapping renders would corrupt each
// other, and the disc SFX (which reads Tone.getContext() to play a one-shot) must
// not fire into a render. So all offline renders go through runRender(), which
// serializes them and marks isRendering() while one is in flight.
//
// (The DJ voice used to wait on this too, but it now runs on its own AudioContext
// and no longer touches Tone's global context — so it can talk during a render.)

let active = false;
let chain: Promise<unknown> = Promise.resolve();

export function isRendering(): boolean {
  return active;
}

// Run an offline render exclusively — queued behind any in-flight render.
export function runRender<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(async () => {
    active = true;
    try {
      return await fn();
    } finally {
      active = false;
    }
  });
  chain = result.then(() => {}, () => {}); // keep the chain alive through failures
  return result as Promise<T>;
}
