import { resolveProgression, getScale } from "../music/harmony/index";
import { generateMotif } from "../music/motifs/generator";
import { createSeed } from "../utils/randomField";
import { field } from "../music/random/randomField";
import type { CompositionIntent } from "./intentSchema";
import type { CompositionPlan, CompositionSection, EvolutionProfile, Motif, Phrase } from "./types";
import type { ComposerSettings } from "../features/composer/types";
import type { SoundMood } from "../sounds/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildEvolutionProfile(energy: number, complexity: number, tension: number): EvolutionProfile {
  return {
    motifMutationChance: clamp(0.05 + complexity * 0.1 + tension * 0.05, 0.02, 0.3),
    chordChangeChance: clamp(0.05 + energy * 0.08, 0.02, 0.25),
    instrumentChangeChance: clamp(0.05 + complexity * 0.06, 0.02, 0.22),
    densityDrift: clamp(0.02 + complexity * 0.06 + energy * 0.03, 0.01, 0.2),
    rhythmVariation: clamp(0.05 + energy * 0.05 + complexity * 0.05, 0.02, 0.35),
  };
}

const MOTIF_LAYERS: Array<Motif["layer"]> = ["pad", "texture", "pulse"];

// A short evocative mood word (drives the disc hue + tint). Richer than the old
// energy+mode rule so different feels read as different colours.
function deriveMood(energy: number, tension: number, brightness: number, calmness: number, minor: boolean): string {
  if (tension > 0.62) return "tense";
  if (energy > 0.66) return brightness > 0.55 ? "energised" : "focused";
  if (energy < 0.38) return calmness > 0.6 ? "calm" : minor ? "ambient" : "still";
  return brightness > 0.6 ? "bright" : minor ? "ambient" : "focused";
}

// Intensity arc archetypes — the shape of the intro→…→outro energy curve. Chosen
// by mood + seed so tracks don't all follow the same build-to-peak-and-release.
function pickArc(energy: number, calmness: number, r: number): number[] {
  if (calmness > 0.6 && energy < 0.5) return [0.5, 0.62, 0.58, 0.66, 0.54]; // gentle, steady
  if (energy > 0.6) return [0.5, 0.72, 0.9, 1.0, 0.78];                     // build to a peak
  if (r < 0.4) return [0.6, 0.85, 0.55, 0.9, 0.62];                        // ebb and flow
  if (r < 0.7) return [0.55, 0.7, 0.85, 0.7, 0.9];                          // late swell
  return [0.7, 0.6, 0.8, 0.6, 0.72];                                        // wavy / undulating
}
// Sample an arc (any length) at a normalized position 0..1.
function arcAt(arc: number[], t: number): number {
  const x = clamp(t, 0, 1) * (arc.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  return (arc[i] ?? 0.7) * (1 - f) + (arc[Math.min(arc.length - 1, i + 1)] ?? 0.7) * f;
}

function sectionMoodFor(intensity: number): CompositionSection["mood"] {
  return intensity > 0.8 ? "energised" : intensity > 0.6 ? "focused" : intensity > 0.42 ? "calm" : "ambient";
}

export function buildCompositionPlanFromIntent(
  intent: CompositionIntent,
  composerSettings?: ComposerSettings,
  seed?: number,
  mood?: SoundMood,
): CompositionPlan {
  const planSeed = seed ?? createSeed();
  const rnd = (salt: string) => field(planSeed, 0, salt)(); // deterministic 0..1 per salt

  const motifDensity = composerSettings?.motifDensity ?? intent.motifDensity;
  const complexity = composerSettings?.complexity ?? intent.complexity;

  // Mood axes threaded DETERMINISTICALLY from a SoundMood (lean-in / your sound)
  // when present — so different moods actually diverge instead of being laundered
  // through the LLM as prose — else derived from the model's intent.
  const minor = intent.key.mode === "minor";
  const energy = clamp(mood?.energy ?? intent.energy, 0, 1);
  const tension = clamp(mood?.tension ?? (minor ? 0.6 : 0.3), 0, 1);
  const brightness = clamp(mood?.brightness ?? 0.5, 0, 1);
  const calmness = clamp(mood?.calmness ?? 1 - energy, 0, 1);

  const scale = getScale(intent.key.tonic, intent.key.mode);
  const use7th = complexity > 0.35 || tension > 0.6;
  const effectiveProgression = composerSettings?.harmonicMovement && composerSettings.harmonicMovement > 0.7
    ? [...intent.progression, intent.progression[0]].slice(0, 5)
    : intent.progression;
  const progression = resolveProgression(intent.key, effectiveProgression, use7th);

  // Tempo: wide, energy-driven (themes still override via applySoundToPlan).
  const bpm = Math.round(58 + energy * 74); // ~58–132
  const globalMood = deriveMood(energy, tension, brightness, calmness, minor);
  const evolutionProfile = buildEvolutionProfile(energy, complexity, tension);
  const duration = 80 + Math.round((complexity + energy) * 40 + rnd("dur") * 40); // ~80–180s

  const motifs = progression.map((chord, index) => {
    const { notes, rhythm } = generateMotif(scale, chord.notes, motifDensity, planSeed, index, energy, complexity);
    return { id: `motif-${index + 1}`, layer: MOTIF_LAYERS[index % MOTIF_LAYERS.length], notes, rhythm };
  });

  const phrases = motifs.map((motif, index) => {
    const role: Phrase["role"] = index === 0 ? "static" : index === 1 ? "build" : "transition";
    return { id: `phrase-${index + 1}`, motifs: [motif.id], length: 15, variation: Math.min(1, complexity * 0.5 + index * 0.05), role };
  });

  // Arrangement: an archetype arc (mood + seed) sampled across a mood-varied
  // section count, so structure differs track to track.
  const arc = pickArc(energy, calmness, rnd("arc"));
  const sectionCount = clamp(2 + Math.round(complexity * 2 + rnd("secs") * 2), 2, 6);
  const secDur = Math.max(6, Math.floor(duration / sectionCount));
  const arcLift = 0.45 + energy * 0.55;
  const sections: CompositionSection[] = Array.from({ length: sectionCount }, (_, i) => {
    const intensity = clamp(arcAt(arc, sectionCount > 1 ? i / (sectionCount - 1) : 0) * arcLift, 0, 1);
    return {
      start: i * secDur,
      duration: i === sectionCount - 1 ? Math.max(1, duration - i * secDur) : secDur,
      mood: sectionMoodFor(intensity),
      intensity,
      phraseIds: [phrases[i % phrases.length]?.id ?? phrases[0]?.id ?? ""],
    };
  });

  // Voice a harmonic bed per section, register set by brightness.
  const baseOct = brightness > 0.62 ? 4 : 3;
  const voiceChord = (notes: string[]) => notes.map((pc, i) => `${pc}${i >= 3 ? baseOct + 1 : baseOct}`);
  const chordEvents = sections.map((s, i) => {
    const chord = progression[i % Math.max(1, progression.length)];
    return { notes: chord ? voiceChord(chord.notes) : [], start: s.start, duration: s.duration };
  });
  const bassEvents = sections.map((s, i) => {
    const chord = progression[i % Math.max(1, progression.length)];
    return { note: chord ? `${chord.notes[0]}${baseOct - 1}` : "C2", start: s.start, duration: s.duration };
  });

  return {
    key: `${intent.key.tonic} ${intent.key.mode}`,
    bpm,
    duration,
    seed: planSeed,
    globalMood,
    evolutionProfile,
    sections,
    chordEvents,
    bassEvents,
    percussionDensity: clamp(energy * 0.95 - calmness * 0.25, 0, 1),
    arpDensity: clamp(motifDensity * 0.5 + brightness * 0.4, 0, 1),
    vocalLevel: clamp((1 - energy) * 0.25 + calmness * 0.4 + complexity * 0.2, 0, 1),
    texture: {
      density: clamp(motifDensity * 0.7 + energy * 0.3, 0, 1),
      brightness: clamp(0.28 + brightness * 0.62, 0, 1),
      reverbAmount: clamp(0.28 + calmness * 0.45, 0, 1),
    },
    // Mood-derived layer mix (was a fixed constant). Themes still override via
    // applySoundToPlan; this drives the non-theme / your-sound paths + defaults.
    layers: {
      drone: clamp(0.22 + calmness * 0.45 - energy * 0.08, 0.05, 0.9),
      pad: clamp(0.5 + calmness * 0.3, 0.2, 0.95),
      texture: clamp(0.28 + brightness * 0.5, 0.1, 0.9),
      pulse: clamp(0.12 + energy * 0.6, 0.04, 0.9),
    },
    motifs,
    phrases,
  };
}
