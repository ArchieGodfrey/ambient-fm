// Instrument palettes for the harmonic bed. Each palette gives the pad / bass /
// arp voices a distinct timbre — via Tone's rich oscillator types (fat*, fm*,
// pwm, …) + envelopes — so different tracks actually sound like different
// instruments. Chosen per-track from the mood (hybrid: deterministic map). All
// synthesis, so fully offline; sampled real instruments can slot in later as
// extra palettes.

export type VoiceCfg = {
  oscType: string; // Tone OmniOscillator type: sine/triangle/sawtooth/square/fatsawtooth/fatsquare/fmsine/pwm…
  a: number; d: number; s: number; r: number; // ADSR
  vol: number; // dB
};

export type Palette = { id: string; label: string; pad: VoiceCfg; bass: VoiceCfg; arp: VoiceCfg };

export const PALETTES: Record<string, Palette> = {
  glass: {
    id: "glass", label: "Glass",
    pad: { oscType: "triangle", a: 0.5, d: 0.8, s: 0.7, r: 2.5, vol: -20 },
    bass: { oscType: "sine", a: 0.06, d: 0.4, s: 0.8, r: 1, vol: -15 },
    arp: { oscType: "triangle", a: 0.005, d: 0.2, s: 0, r: 0.3, vol: -20 },
  },
  warm: {
    id: "warm", label: "Warm tape",
    pad: { oscType: "fatsawtooth", a: 0.8, d: 1.0, s: 0.6, r: 3.0, vol: -23 },
    bass: { oscType: "sine", a: 0.05, d: 0.5, s: 0.85, r: 1.2, vol: -14 },
    arp: { oscType: "triangle", a: 0.005, d: 0.25, s: 0, r: 0.4, vol: -22 },
  },
  strings: {
    id: "strings", label: "Strings",
    pad: { oscType: "sawtooth", a: 1.4, d: 1.0, s: 0.75, r: 3.5, vol: -24 },
    bass: { oscType: "sine", a: 0.1, d: 0.5, s: 0.8, r: 1.5, vol: -15 },
    arp: { oscType: "sine", a: 0.01, d: 0.3, s: 0, r: 0.5, vol: -22 },
  },
  bells: {
    id: "bells", label: "Bells",
    pad: { oscType: "fmsine", a: 0.01, d: 1.2, s: 0.3, r: 2.0, vol: -19 },
    bass: { oscType: "sine", a: 0.03, d: 0.4, s: 0.7, r: 1.0, vol: -16 },
    arp: { oscType: "fmsine", a: 0.002, d: 0.4, s: 0, r: 0.4, vol: -19 },
  },
  reed: {
    id: "reed", label: "Reed",
    pad: { oscType: "pwm", a: 0.4, d: 0.6, s: 0.7, r: 2.0, vol: -23 },
    bass: { oscType: "triangle", a: 0.05, d: 0.4, s: 0.8, r: 1.0, vol: -15 },
    arp: { oscType: "square", a: 0.005, d: 0.2, s: 0, r: 0.3, vol: -25 },
  },
  synth: {
    id: "synth", label: "Synth",
    pad: { oscType: "fatsquare", a: 0.3, d: 0.7, s: 0.6, r: 2.2, vol: -24 },
    bass: { oscType: "sawtooth", a: 0.03, d: 0.3, s: 0.75, r: 0.8, vol: -16 },
    arp: { oscType: "square", a: 0.004, d: 0.18, s: 0, r: 0.28, vol: -23 },
  },
};

// Deterministic mood → palette (hybrid). Tie-breaks use the seed roll `r`.
export function pickPaletteId(energy: number, tension: number, brightness: number, calmness: number, r: number): string {
  if (tension > 0.6) return r < 0.5 ? "reed" : "synth";
  if (energy > 0.62) return brightness > 0.55 ? "synth" : "bells";
  if (calmness > 0.6) return brightness > 0.55 ? "glass" : "strings";
  if (brightness > 0.6) return "bells";
  return r < 0.5 ? "warm" : "strings";
}
