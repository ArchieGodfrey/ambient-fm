import * as Tone from "tone";
import { PALETTES, SAMPLE_INSTRUMENTS, VOWELS, PALETTE_VOWEL, type VoiceCfg } from "./palettes";

// Voices the harmonic bed — block chords + a bass root — as looping Tone.Parts
// over the section timeline (seconds), plus an optional arpeggio over the
// current chord. Mirrors melodyTrack. Makes harmony audible (the pad chord was
// never triggered before), grounded by bass, and moving via chord changes/arps.
type ChordEvent = { notes: string[]; start: number; duration: number };
type BassEvent = { note: string; start: number; duration: number };

let chordPart: Tone.Part | null = null;
let bassPart: Tone.Part | null = null;
let arpLoop: Tone.Loop | null = null;
let padSynth: Tone.PolySynth | Tone.Sampler | null = null;
let bassSynth: Tone.Synth | null = null;
let arpSynth: Tone.Synth | Tone.Sampler | null = null;
let choirSynth: Tone.PolySynth | null = null;
let choirVibrato: Tone.Vibrato | null = null;
let choirFormants: { bp: Tone.Filter; g: Tone.Gain }[] = [];
let currentChord: string[] = [];
let arpIndex = 0;
let currentPaletteId = "";

const upOctave = (note: string) => note.replace(/(\d)$/, (d) => String(Number(d) + 1));

const env = (c: VoiceCfg) => ({ attack: c.a, decay: c.d, sustain: c.s, release: c.r });
function makePoly(c: VoiceCfg): Tone.PolySynth {
  const s = new Tone.PolySynth(Tone.Synth, { oscillator: { type: c.oscType as never }, envelope: env(c) }).toDestination();
  s.volume.value = c.vol;
  return s;
}
function makeMono(c: VoiceCfg): Tone.Synth {
  const s = new Tone.Synth({ oscillator: { type: c.oscType as never }, envelope: env(c) }).toDestination();
  s.volume.value = c.vol;
  return s;
}
function makeSampler(inst: string, vol: number): Tone.Sampler {
  const s = new Tone.Sampler({ urls: SAMPLE_INSTRUMENTS[inst], baseUrl: `${import.meta.env.BASE_URL}samples/${inst}/` }).toDestination();
  s.volume.value = vol;
  return s;
}

// (Re)build the pad/bass/arp voices for the given palette. On a palette change we
// dispose the old voices and create the new timbres; the choir stays constant.
function ensure(paletteId?: string) {
  const id = paletteId && PALETTES[paletteId] ? paletteId : PALETTES[currentPaletteId] ? currentPaletteId : "glass";
  if (id !== currentPaletteId) {
    padSynth?.dispose(); bassSynth?.dispose(); arpSynth?.dispose();
    padSynth = null; bassSynth = null; arpSynth = null;
    // the choir's vowel is palette-dependent → rebuild it too
    choirSynth?.dispose(); choirVibrato?.dispose();
    choirFormants.forEach(({ bp, g }) => { bp.dispose(); g.dispose(); });
    choirSynth = null; choirVibrato = null; choirFormants = [];
    currentPaletteId = id;
  }
  const p = PALETTES[currentPaletteId];
  if (!padSynth) padSynth = p.sample ? makeSampler(p.sample, p.pad.vol) : makePoly(p.pad);
  if (!bassSynth) bassSynth = makeMono(p.bass);
  if (!arpSynth) arpSynth = p.sample ? makeSampler(p.sample, p.arp.vol) : makeMono(p.arp);
  if (!choirSynth) {
    // A sung-vowel choir via FORMANT SYNTHESIS: a sawtooth swell (with gentle
    // vibrato) fed through parallel band-pass filters tuned to the vowel's F1/F2/F3
    // resonances — reads as a real "aah/ooh/…" rather than a filtered buzz. The
    // vowel is chosen by the palette. Kept soft so it colours rather than dominates.
    const vowel = VOWELS[PALETTE_VOWEL[currentPaletteId] ?? "aah"] ?? VOWELS.aah;
    choirVibrato = new Tone.Vibrato({ frequency: 5, depth: 0.1 });
    choirFormants = vowel.f.map((freq, i) => {
      const bp = new Tone.Filter({ type: "bandpass", frequency: freq, Q: 8 });
      const g = new Tone.Gain(vowel.g[i] * 0.5).toDestination();
      choirVibrato!.connect(bp);
      bp.connect(g);
      return { bp, g };
    });
    choirSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 1.2, decay: 0.6, sustain: 0.85, release: 3 } }).connect(choirVibrato);
    choirSynth.volume.value = -16;
  }
}

export function setHarmony(chords?: ChordEvent[], bass?: BassEvent[], arpDensity = 0, vocalLevel = 0, paletteId?: string) {
  stopHarmony();
  const hasChords = !!chords?.length;
  const hasBass = !!bass?.length;
  if (!hasChords && !hasBass) return;
  ensure(paletteId);
  const end = Math.max(1, ...[...(chords ?? []), ...(bass ?? [])].map((e) => e.start + e.duration));

  if (hasChords && padSynth) {
    const synth = padSynth;
    const choir = vocalLevel > 0.45 ? choirSynth : null; // "aah" pad on richer tracks
    chordPart = new Tone.Part((time, ev: { notes: string[]; duration: number }) => {
      if (ev.notes.length) synth.triggerAttackRelease(ev.notes, ev.duration, time, 0.5);
      // Sing the top two chord tones up an octave for a soft choral swell.
      if (choir && ev.notes.length) choir.triggerAttackRelease(ev.notes.slice(-2).map(upOctave), ev.duration, time, 0.5);
      currentChord = ev.notes; // feed the arp
    }, chords!.map((c) => ({ time: c.start, notes: c.notes, duration: c.duration })));
    chordPart.loop = true;
    chordPart.loopEnd = end;
    chordPart.start(0);
    currentChord = chords![0].notes;
  }
  if (hasBass && bassSynth) {
    const synth = bassSynth;
    bassPart = new Tone.Part((time, ev: { note: string; duration: number }) => {
      synth.triggerAttackRelease(ev.note, ev.duration, time, 0.7);
    }, bass!.map((b) => ({ time: b.start, note: b.note, duration: b.duration })));
    bassPart.loop = true;
    bassPart.loopEnd = end;
    bassPart.start(0);
  }

  // Arpeggio over whatever chord is currently sounding (tempo-synced).
  if (arpDensity > 0.4 && arpSynth) {
    const synth = arpSynth;
    arpIndex = 0;
    arpLoop = new Tone.Loop((time) => {
      if (!currentChord.length) return;
      const note = upOctave(currentChord[arpIndex % currentChord.length]);
      synth.triggerAttackRelease(note, "16n", time, 0.4);
      arpIndex += 1;
    }, arpDensity > 0.7 ? "8n" : "4n");
    arpLoop.start(0);
  }
}

export function stopHarmony() {
  chordPart?.dispose();
  bassPart?.dispose();
  if (arpLoop) { arpLoop.stop(); arpLoop.dispose(); arpLoop = null; }
  // Release any sounding voices — disposing the Parts only stops scheduling; a
  // held chord (long duration + 2.5–3s release) would otherwise ring on as a
  // "drone" if the master is ever un-muted.
  // Release sounding voices (PolySynth/Sampler use releaseAll; a mono Synth uses
  // triggerRelease) so a held chord doesn't ring on if the master is un-muted.
  const rel = (v: Tone.PolySynth | Tone.Sampler | Tone.Synth | null) => {
    try { if (v && "releaseAll" in v) v.releaseAll(); else (v as Tone.Synth | null)?.triggerRelease(); } catch { /* not started */ }
  };
  rel(padSynth);
  rel(arpSynth);
  rel(choirSynth);
  try { bassSynth?.triggerRelease(); } catch { /* not started */ }
  chordPart = null;
  bassPart = null;
  currentChord = [];
}

// Dispose every cached voice (not just the Parts, as stopHarmony does) and null
// the singletons so the next setHarmony() rebuilds them in whatever Tone context
// is active — needed to render into an offline context and to rebuild live after.
export function resetHarmony() {
  stopHarmony();
  const safe = (fn: () => void) => { try { fn(); } catch { /* node from a disposed context */ } };
  safe(() => padSynth?.dispose());
  safe(() => bassSynth?.dispose());
  safe(() => arpSynth?.dispose());
  safe(() => choirSynth?.dispose());
  safe(() => choirVibrato?.dispose());
  choirFormants.forEach(({ bp, g }) => { safe(() => bp.dispose()); safe(() => g.dispose()); });
  padSynth = null;
  bassSynth = null;
  arpSynth = null;
  choirSynth = null;
  choirVibrato = null;
  choirFormants = [];
  currentPaletteId = "";
  arpIndex = 0;
}
