import { db } from "../db/db";
import type { CompositionPlan } from "../ai/types";

export interface RuntimeSnapshot {
  id: string;
  timestamp: number;
  plan: CompositionPlan;
  cursorTime: number;
  activeSectionId: string;
  activePhraseIds: string[];
  layerStates: {
    drone: number;
    pad: number;
    texture: number;
    pulse: number;
  };
}

const MAX_SNAPSHOTS = 50;

export async function saveSnapshot(snapshot: RuntimeSnapshot) {
  await db.runtimeSnapshots.put(snapshot);

  const count = await db.runtimeSnapshots.count();
  if (count > MAX_SNAPSHOTS) {
    const excess = count - MAX_SNAPSHOTS;
    const oldest = await db.runtimeSnapshots.orderBy("timestamp").limit(excess).toArray();
    await db.runtimeSnapshots.bulkDelete(oldest.map((item) => item.id));
  }

  return await db.runtimeSnapshots.count();
}

export async function getLastSnapshot(): Promise<RuntimeSnapshot | undefined> {
  return await db.runtimeSnapshots.orderBy("timestamp").last();
}
