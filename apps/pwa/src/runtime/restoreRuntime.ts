import { db } from "../db/db";
import { startAudio } from "../audio/toneEngine";
import { initAudioGraph } from "../audio/audioGraph";
import { initMotifs } from "../audio/motifManager";
import { startCompositionRuntime } from "../audio/compositionRuntime";
import type { RuntimeSnapshot } from "../memory/runtimeSnapshots";

export async function restoreRuntime(options?: { startAudio?: boolean }) {
  const last = await db.runtimeSnapshots.orderBy("timestamp").last();
  if (!last) {
    return null;
  }

  // Only touch the audio graph / scheduler when actually starting playback.
  // On load we restore for DISPLAY only (startAudio false) — building the graph
  // or the composition runtime here made a stray note play on page load.
  if (options?.startAudio) {
    initAudioGraph();
    initMotifs(last.plan.motifs);
    await startAudio();
    startCompositionRuntime(last.plan, last.cursorTime);
  }

  return last as RuntimeSnapshot;
}
