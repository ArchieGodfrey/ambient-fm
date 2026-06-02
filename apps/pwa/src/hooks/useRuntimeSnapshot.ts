import { useEffect, useState } from "react";
import { subscribeRuntimeState, type CompositionRuntimeSnapshot } from "../audio/compositionRuntime";

const defaultSnapshot: CompositionRuntimeSnapshot = {
  cursor: 0,
  activeSection: null,
  activePhrase: null,
  intensity: 0,
  drift: 0,
  planDuration: 0,
  sectionTimeRemaining: 0,
  activeMotifs: 0,
  runtimeUptime: 0,
  frameDelay: 0,
  audioRestartCount: 0,
  snapshotCount: 0,
  currentLyricLine: null,
};

export function useRuntimeSnapshot(): CompositionRuntimeSnapshot {
  const [snapshot, setSnapshot] = useState<CompositionRuntimeSnapshot>(defaultSnapshot);

  useEffect(() => {
    return subscribeRuntimeState(setSnapshot);
  }, []);

  return snapshot;
}
