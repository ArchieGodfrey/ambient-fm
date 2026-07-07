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
}

export function setHarmony(chords?: ChordEvent[], bass?: BassEvent[], arpDensity = 0) {
  stopHarmony();
  const hasChords = !!chords?.length;
  const hasBass = !!bass?.length;
  if (!hasChords && !hasBass) return;
  ensure();
  const end = Math.max(1, ...[...(chords ?? []), ...(bass ?? [])].map((e) => e.start + e.duration));

  if (hasChords && padSynth) {
    const synth = padSynth;
    chordPart = new Tone.Part((time, ev: { notes: string[]; duration: number }) => {
      if (ev.notes.length) synth.triggerAttackRelease(ev.notes, ev.duration, time, 0.5);
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
  chordPart = null;
  bassPart = null;
  currentChord = [];
}
