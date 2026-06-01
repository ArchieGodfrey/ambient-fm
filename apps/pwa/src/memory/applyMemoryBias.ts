import type { CompositionPlan } from "../ai/types";
import type { SessionSummary } from "./types";

export function applyMemoryBias(plan: CompositionPlan, sessions: SessionSummary[]) {
  if (!sessions.length) {
    return plan;
  }

  const avgBpm =
    sessions.reduce((sum, session) => sum + session.avgBpm, 0) /
    sessions.length;

  const avgLayerProfile = sessions.reduce(
    (acc, session) => {
      acc.drone += session.layerProfile.drone;
      acc.pad += session.layerProfile.pad;
      acc.texture += session.layerProfile.texture;
      acc.pulse += session.layerProfile.pulse;
      return acc;
    },
    { drone: 0, pad: 0, texture: 0, pulse: 0 },
  );

  const blend = (current: number, historical: number) =>
    current * 0.8 + historical * 0.2;

  plan.bpm = plan.bpm * 0.7 + avgBpm * 0.3;
  plan.layers.drone = blend(plan.layers.drone, avgLayerProfile.drone / sessions.length);
  plan.layers.pad = blend(plan.layers.pad, avgLayerProfile.pad / sessions.length);
  plan.layers.texture = blend(plan.layers.texture, avgLayerProfile.texture / sessions.length);
  plan.layers.pulse = blend(plan.layers.pulse, avgLayerProfile.pulse / sessions.length);

  return plan;
}
