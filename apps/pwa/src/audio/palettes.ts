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

// A palette may be a pure-synth palette, or use a sampled real instrument for its
// pad + arp (bass stays a synth). `sample` names a folder under public/samples/.
export type Palette = { id: string; label: string; sample?: string; pad: VoiceCfg; bass: VoiceCfg; arp: VoiceCfg };

// Sampled real instruments (curated subsets from tonejs-instruments; Tone.Sampler
// pitch-shifts between them). Bundled in public/samples/<inst>/ and cached offline
// via the setup wizard (see audio/sampleLibrary.ts).
export const SAMPLE_INSTRUMENTS: Record<string, Record<string, string>> = {
  piano: { C2: "C2.mp3", G2: "G2.mp3", C3: "C3.mp3", G3: "G3.mp3", C4: "C4.mp3", G4: "G4.mp3", C5: "C5.mp3", G5: "G5.mp3", C6: "C6.mp3" },
  harp: { C3: "C3.mp3", E3: "E3.mp3", G3: "G3.mp3", C5: "C5.mp3", E5: "E5.mp3", G5: "G5.mp3" },
  cello: { C2: "C2.mp3", G2: "G2.mp3", C3: "C3.mp3", E3: "E3.mp3", G3: "G3.mp3", C4: "C4.mp3", G4: "G4.mp3" },
};

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
  // Sampled real instruments (pad + arp use the sampler; bass is a synth). The
  // pad/arp VoiceCfg are synth fallbacks if samples can't load.
  piano: {
    id: "piano", label: "Felt piano", sample: "piano",
    pad: { oscType: "triangle", a: 0.01, d: 1.4, s: 0.2, r: 2.2, vol: -12 },
    bass: { oscType: "sine", a: 0.05, d: 0.5, s: 0.8, r: 1.2, vol: -16 },
    arp: { oscType: "triangle", a: 0.005, d: 0.4, s: 0, r: 0.5, vol: -14 },
  },
  harp: {
    id: "harp", label: "Harp", sample: "harp",
    pad: { oscType: "triangle", a: 0.01, d: 1.2, s: 0.15, r: 2.0, vol: -12 },
    bass: { oscType: "sine", a: 0.06, d: 0.5, s: 0.8, r: 1.2, vol: -16 },
    arp: { oscType: "triangle", a: 0.004, d: 0.5, s: 0, r: 0.6, vol: -13 },
  },
  cello: {
    id: "cello", label: "Cello", sample: "cello",
    pad: { oscType: "sawtooth", a: 0.6, d: 0.8, s: 0.8, r: 2.5, vol: -14 },
    bass: { oscType: "sine", a: 0.08, d: 0.5, s: 0.85, r: 1.5, vol: -15 },
    arp: { oscType: "sine", a: 0.02, d: 0.4, s: 0.2, r: 0.6, vol: -16 },
  },
};

// Deterministic mood → palette (hybrid). Acoustic sampled instruments (piano/
// harp/cello) favour calm/warm/bright feels; synths cover energetic/tense.
// Tie-breaks use the seed roll `r`.
export function pickPaletteId(energy: number, tension: number, brightness: number, calmness: number, r: number): string {
  if (tension > 0.6) return r < 0.5 ? "cello" : "synth";
  if (energy > 0.62) return brightness > 0.55 ? "synth" : "bells";
  if (calmness > 0.6) return brightness > 0.55 ? "piano" : r < 0.5 ? "harp" : "strings";
  if (brightness > 0.6) return r < 0.5 ? "piano" : "bells";
  return r < 0.5 ? "warm" : "cello";
}
