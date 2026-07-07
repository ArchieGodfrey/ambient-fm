import * as Tone from "tone";

// Plays a user-recorded melody (timed notes with durations) as a looping track
// on the Transport, layered over the algorithmic soundscape. This respects the
// actual timing and hold-lengths the user played — unlike the fixed-rhythm motif
// engine — so the recorded melody is heard in the composition, not just on tap.
type TimedNote = { note: string; start: number; duration: number };

let part: Tone.Part | null = null;
let synth: Tone.PolySynth | null = null;

function ensureSynth() {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.35, release: 0.8 },
    }).toDestination();
    synth.volume.value = -11;
  }
  return synth;
}

export function setMelody(notes?: TimedNote[]) {
  stopMelody();
  if (!notes || notes.length === 0) return;
  const s = ensureSynth();
  const end = Math.max(...notes.map((n) => n.start + n.duration)) + 0.5;
  part = new Tone.Part((time, ev: { note: string; duration: number }) => {
    s.triggerAttackRelease(ev.note, ev.duration, time);
  }, notes.map((n) => ({ time: n.start, note: n.note, duration: n.duration })));
  part.loop = true;
  part.loopEnd = end;
  part.start(0);
}

export function stopMelody() {
  if (part) {
    part.dispose();
    part = null;
  }
}
