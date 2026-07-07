import * as Tone from "tone";

// Selectable timbres for the foreground melody (the user's part). All are
// PolySynth<Synth> voices so the types stay simple and overlaps are allowed.
export const MELODY_INSTRUMENTS = [
  { id: "soft", label: "Soft" },
  { id: "glass", label: "Glass" },
  { id: "reed", label: "Reed" },
  { id: "bright", label: "Bright" },
  { id: "pluck", label: "Pluck" },
] as const;

export type MelodyInstrumentId = (typeof MELODY_INSTRUMENTS)[number]["id"];
export const DEFAULT_MELODY_INSTRUMENT: MelodyInstrumentId = "soft";

type Preset = { osc: "triangle" | "sine" | "sawtooth" | "square"; env: { attack: number; decay: number; sustain: number; release: number } };

const PRESETS: Record<string, Preset> = {
  soft: { osc: "triangle", env: { attack: 0.005, decay: 0.28, sustain: 0.3, release: 0.7 } },
  glass: { osc: "sine", env: { attack: 0.01, decay: 0.5, sustain: 0.25, release: 1.4 } },
  reed: { osc: "sawtooth", env: { attack: 0.03, decay: 0.2, sustain: 0.45, release: 0.5 } },
  bright: { osc: "square", env: { attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.4 } },
  pluck: { osc: "triangle", env: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 } },
};

export function createMelodySynth(id: string): Tone.PolySynth {
  const p = PRESETS[id] ?? PRESETS.soft;
  return new Tone.PolySynth(Tone.Synth, { oscillator: { type: p.osc }, envelope: p.env });
}
