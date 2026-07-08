import * as Tone from "tone";

// Voices the harmonic bed — block chords + a bass root — as looping Tone.Parts
// over the section timeline (seconds), plus an optional arpeggio over the
// current chord. Mirrors melodyTrack. Makes harmony audible (the pad chord was
// never triggered before), grounded by bass, and moving via chord changes/arps.
type ChordEvent = { notes: string[]; start: number; duration: number };
type BassEvent = { note: string; start: number; duration: number };

let chordPart: Tone.Part | null = null;
let bassPart: Tone.Part | null = null;
let arpLoop: Tone.Loop | null = null;
let padSynth: Tone.PolySynth | null = null;
let bassSynth: Tone.Synth | null = null;
let arpSynth: Tone.Synth | null = null;
let choirSynth: Tone.PolySynth | null = null;
let choirVibrato: Tone.Vibrato | null = null;
let choirFilter: Tone.Filter | null = null;
let currentChord: string[] = [];
let arpIndex = 0;

const upOctave = (note: string) => note.replace(/(\d)$/, (d) => String(Number(d) + 1));

function ensure() {
  if (!padSynth) {
    padSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.5, decay: 0.8, sustain: 0.7, release: 2.5 } }).toDestination();
    padSynth.volume.value = -20;
  }
  if (!bassSynth) {
    bassSynth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.06, decay: 0.4, sustain: 0.8, release: 1 } }).toDestination();
    bassSynth.volume.value = -15;
  }
  if (!arpSynth) {
    arpSynth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.3 } }).toDestination();
    arpSynth.volume.value = -20;
  }
  if (!choirSynth) {
    // A breathy "aah" choir: a sawtooth swell through a vowel-ish bandpass with
    // gentle vibrato — a synthesized vocal texture (the near-term step toward
    // real vocals). Kept soft so it colours rather than dominates.
    choirFilter = new Tone.Filter({ type: "bandpass", frequency: 900, Q: 1.4 }).toDestination();
    choirVibrato = new Tone.Vibrato({ frequency: 5, depth: 0.12 }).connect(choirFilter);
    choirSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 1.2, decay: 0.6, sustain: 0.8, release: 3 } }).connect(choirVibrato);
    choirSynth.volume.value = -26;
  }
}

export function setHarmony(chords?: ChordEvent[], bass?: BassEvent[], arpDensity = 0, vocalLevel = 0) {
  stopHarmony();
  const hasChords = !!chords?.length;
  const hasBass = !!bass?.length;
  if (!hasChords && !hasBass) return;
  ensure();
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
  try {
    padSynth?.releaseAll();
    choirSynth?.releaseAll();
    bassSynth?.triggerRelease();
    arpSynth?.triggerRelease();
  } catch { /* not started */ }
  chordPart = null;
  bassPart = null;
  currentChord = [];
}
