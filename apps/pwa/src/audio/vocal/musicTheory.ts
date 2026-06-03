import type { CompositionPlan, CompositionSection } from '../../ai/types';

const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

const C4_HZ = 261.63;

export interface SingingParams {
  rootHz: number;
  chordNotesHz: number[];
  vibratoRate: number;
  vibratoDepth: number;
  targetDurationSec: number; // Phase 3: how long the phrase should be
}

function noteNameToHz(noteName: string): number {
  const m = noteName.match(/^([A-G][#b]?)(\d+)$/);
  if (!m) return C4_HZ;
  const semitones = NOTE_SEMITONES[m[1]] ?? 0;
  const octave = parseInt(m[2]);
  return C4_HZ * Math.pow(2, (semitones + (octave - 4) * 12) / 12);
}

function toVocalOctave(hz: number): number {
  let f = hz;
  while (f < 220) f *= 2;
  while (f > 480) f /= 2;
  return f;
}

export function getSingingParams(
  plan: CompositionPlan,
  section: CompositionSection,
): SingingParams {
  const parts = plan.key.trim().split(/\s+/);
  const tonic = parts[0] ?? 'C';
  const rootHz = toVocalOctave(C4_HZ * Math.pow(2, (NOTE_SEMITONES[tonic] ?? 0) / 12));

  const phraseId = section.phraseIds?.[0];
  const phrase = plan.phrases?.find(p => p.id === phraseId);
  const motifId = phrase?.motifs?.[0];
  const motif = plan.motifs?.find(m => m.id === motifId);

  const chordNotesHz = motif?.notes?.length
    ? motif.notes.map(n => toVocalOctave(noteNameToHz(n)))
    : [rootHz];

  const tenseMoods = new Set(['tense', 'energised', 'focused']);
  const moodFactor = tenseMoods.has(section.mood) ? 1.2 : 0.8;
  const intensity = section.intensity ?? 0.5;
  const vibratoRate = 5.5 + intensity * 2;
  const vibratoDepth = 0.08 + intensity * moodFactor * 0.25;

  // Phase 3: target duration based on BPM and intensity
  // Calm/ambient → 2 bars; focused → 3 bars; tense/energised → 4 bars
  const bpm = plan.bpm ?? 72;
  const secPerBar = (60 / bpm) * 4;
  const bars = intensity < 0.4 ? 2 : intensity < 0.7 ? 3 : 4;
  // Don't exceed 45% of the section — leave room for texture
  const targetDurationSec = Math.min(bars * secPerBar, section.duration * 0.45);

  return { rootHz, chordNotesHz, vibratoRate, vibratoDepth, targetDurationSec };
}
