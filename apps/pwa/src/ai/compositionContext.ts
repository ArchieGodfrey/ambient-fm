import { getLastSessionSummaries } from "../memory/getMemoryContext";
import type { StimulusEvent } from "../types";
import type { ComposerSettings } from "../features/composer/types";

export interface CompositionMemory {
  recentKeys: string[];
  dominantInstrument: string | null;
  averageDensity: number;
  recurringMotifs: string[];
}

export interface CompositionContext {
  stimuli: StimulusEvent[];
  memory: CompositionMemory;
  composerSettings: ComposerSettings;
  userPreferences: Record<string, unknown>;
}

export async function buildCompositionContext(
  stimuli: StimulusEvent[],
  composerSettings: ComposerSettings,
): Promise<CompositionContext> {
  const sessions = await getLastSessionSummaries();
  const recentKeys = sessions.map((session) => session.key).filter(Boolean).slice(0, 3);
  const dominantInstrument = sessions[0]?.dominantMotifLayer ?? null;
  const averageDensity =
    sessions.length > 0
      ? sessions.reduce((sum, session) => sum + (session.plan?.texture.density ?? 0.45), 0) / sessions.length
      : 0.45;
  const recurringMotifs = sessions
    .flatMap((session) => session.plan?.motifs?.map((motif) => motif.layer ?? motif.id) ?? [])
    .slice(0, 10);

  return {
    stimuli,
    memory: {
      recentKeys,
      dominantInstrument,
      averageDensity,
      recurringMotifs,
    },
    composerSettings,
    userPreferences: {},
  };
}
