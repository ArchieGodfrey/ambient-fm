import { resolveProgression, getScale } from "../music/harmony/index";
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
  const motifDensity = composerSettings?.motifDensity ?? intent.motifDensity;
  const complexity = composerSettings?.complexity ?? intent.complexity;
  const effectiveProgression = composerSettings?.harmonicMovement && composerSettings.harmonicMovement > 0.7
    ? [...intent.progression, intent.progression[0]].slice(0, 5)
    : intent.progression;
  const scale = getScale(intent.key.tonic, intent.key.mode);
  const progression = resolveProgression(intent.key, effectiveProgression, complexity > 0.5);
  const bpm = Math.round(60 + intent.energy * 40);
  const evolutionProfile = buildEvolutionProfile(intent, complexity);
  const duration = 60 + Math.round((complexity + intent.energy) * 30);
  const motifs = progression.map((chord, index) => {
    const { notes, rhythm } = generateMotif(scale, chord.notes, motifDensity, planSeed, index, intent.energy, complexity);
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

  // Multiple sections that each voice a DIFFERENT phrase (so the whole
  // progression is heard, not just 2 chords) and build in intensity like an
  // intro → build → peak → release arc.
  const sectionMoods: CompositionSection["mood"][] = ["ambient", "calm", "focused", "energised"];
  const sectionCount = clamp(Math.min(phrases.length, 4), 2, 4);
  const secDur = Math.max(6, Math.floor(duration / sectionCount));
  const arc = [0.55, 0.75, 1, 0.65]; // relative intensity across the arc
  const sections: CompositionSection[] = Array.from({ length: sectionCount }, (_, i) => ({
    start: i * secDur,
    duration: i === sectionCount - 1 ? Math.max(1, duration - i * secDur) : secDur,
    mood: sectionMoods[i % sectionMoods.length],
    intensity: clamp((arc[i] ?? 0.7) * (0.5 + intent.energy * 0.6), 0, 1),
    phraseIds: [phrases[i % phrases.length]?.id ?? phrases[0]?.id ?? ""],
  }));

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
