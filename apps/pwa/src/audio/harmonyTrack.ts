import * as Tone from "tone";

// Voices the harmonic bed — block chords + a bass root — as looping Tone.Parts
// over the section timeline (seconds). Mirrors melodyTrack. This makes harmony
// actually audible (the pad chord was never triggered before) and gives the
// piece a moving bass and chord changes across sections.
type ChordEvent = { notes: string[]; start: number; duration: number };
type BassEvent = { note: string; start: number; duration: number };

let chordPart: Tone.Part | null = null;
let bassPart: Tone.Part | null = null;
let padSynth: Tone.PolySynth | null = null;
let bassSynth: Tone.Synth | null = null;

function ensure() {
  if (!padSynth) {
    padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.5, decay: 0.8, sustain: 0.7, release: 2.5 },
    }).toDestination();
    padSynth.volume.value = -20;
  }
  if (!bassSynth) {
    bassSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.06, decay: 0.4, sustain: 0.8, release: 1 },
    }).toDestination();
    bassSynth.volume.value = -15;
  }
}

export function setHarmony(chords?: ChordEvent[], bass?: BassEvent[]) {
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
    }, chords!.map((c) => ({ time: c.start, notes: c.notes, duration: c.duration })));
    chordPart.loop = true;
    chordPart.loopEnd = end;
    chordPart.start(0);
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
}

export function stopHarmony() {
  chordPart?.dispose();
  bassPart?.dispose();
  chordPart = null;
  bassPart = null;
}
