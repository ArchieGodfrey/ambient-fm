import { resolveProgression } from "../music/harmony/index";
import { generateMotif } from "../music/motifs/generator";
import { createSeed } from "../utils/randomField";
import type { CompositionIntent } from "./intentSchema";
import type { CompositionPlan, CompositionSection, EvolutionProfile, Motif, Phrase } from "./types";
import type { ComposerSettings } from "../features/composer/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildEvolutionProfile(intent: CompositionIntent, complexity: number): EvolutionProfile {
  return {
    motifMutationChance: clamp(0.05 + complexity * 0.08, 0.02, 0.25),
    chordChangeChance: clamp(0.05 + intent.energy * 0.08, 0.02, 0.25),
    instrumentChangeChance: clamp(0.05 + complexity * 0.05, 0.02, 0.2),
    densityDrift: clamp(0.02 + complexity * 0.06 + intent.energy * 0.03, 0.01, 0.18),
    rhythmVariation: clamp(0.05 + intent.energy * 0.04 + complexity * 0.05, 0.02, 0.3),
  };
}

const MOTIF_LAYERS: Array<Motif["layer"]> = ["pad", "texture", "pulse"];

export function buildCompositionPlanFromIntent(
  intent: CompositionIntent,
  composerSettings?: ComposerSettings,
  seed?: number,
): CompositionPlan {
  const planSeed = seed ?? createSeed();
  const effectiveProgression = composerSettings?.harmonicMovement && composerSettings.harmonicMovement > 0.7
    ? [...intent.progression, intent.progression[0]].slice(0, 5)
    : intent.progression;
  const progression = resolveProgression(intent.key, effectiveProgression);
  const bpm = Math.round(60 + intent.energy * 40);
  const motifDensity = composerSettings?.motifDensity ?? intent.motifDensity;
  const complexity = composerSettings?.complexity ?? intent.complexity;
  const evolutionProfile = buildEvolutionProfile(intent, complexity);
  const duration = 60 + Math.round((complexity + intent.energy) * 30);
  const motifs = progression.map((chord, index) => {
    const notes = generateMotif(chord, motifDensity, planSeed, index).map(
      (note) => `${note}`,
    );
    const rhythm = [1, 0.5, 1, 0.5].slice(0, Math.min(4, notes.length));

    return {
      id: `motif-${index + 1}`,
      layer: MOTIF_LAYERS[index % MOTIF_LAYERS.length],
      notes,
      rhythm,
    };
  });

  const phrases = motifs.map((motif, index) => {
    const role: Phrase["role"] =
      index === 0 ? "static" : index === 1 ? "build" : "transition";

    return {
      id: `phrase-${index + 1}`,
      motifs: [motif.id],
      length: 15,
      variation: Math.min(1, complexity * 0.5 + index * 0.05),
      role,
    };
  });

  const sections: CompositionSection[] = [
    {
      start: 0,
      duration: Math.max(1, Math.floor(duration * 0.5)),
      mood: "ambient",
      intensity: clamp(intent.energy * 0.8, 0, 1),
      phraseIds: [phrases[0]?.id ?? ""],
    },
    {
      start: Math.max(1, Math.floor(duration * 0.5)),
      duration: Math.max(1, Math.ceil(duration * 0.5)),
      mood: "focused",
      intensity: clamp(Math.min(1, intent.energy + 0.1), 0, 1),
      phraseIds: [phrases[1]?.id ?? phrases[0]?.id ?? ""],
    },
  ];

  return {
    key: `${intent.key.tonic} ${intent.key.mode}`,
    bpm,
    duration,
    seed: planSeed,
    globalMood: "intent-driven",
    evolutionProfile,
    sections,
    texture: {
      density: Math.min(1, Math.max(0, motifDensity)),
      brightness: Math.min(1, Math.max(0, 0.5 + complexity * 0.3)),
      reverbAmount: Math.min(1, Math.max(0, 0.4 + intent.energy * 0.2)),
    },
    layers: {
      drone: 0.3,
      pad: 0.7,
      texture: 0.5,
      pulse: 0.3,
    },
    motifs,
    phrases,
  };
}
