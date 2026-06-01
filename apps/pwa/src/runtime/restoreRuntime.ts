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

  initAudioGraph();
  initMotifs(last.plan.motifs);
  if (options?.startAudio) {
    await startAudio();
  }
  startCompositionRuntime(last.plan, last.cursorTime);

  return last as RuntimeSnapshot;
}
