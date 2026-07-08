import * as Tone from "tone";
import { createMelodySynth, DEFAULT_MELODY_INSTRUMENT } from "./melodyInstruments";

// Plays a user-recorded melody (timed notes with durations) as a looping track
// on the Transport, layered over the algorithmic soundscape. This respects the
// actual timing and hold-lengths the user played — unlike the fixed-rhythm motif
// engine — so the recorded melody is heard in the composition, not just on tap.
type TimedNote = { note: string; start: number; duration: number };

let part: Tone.Part | null = null;
let synth: Tone.PolySynth | null = null;
let synthId = "";

function ensureSynth(instrument: string) {
  if (!synth || synthId !== instrument) {
    synth?.dispose();
    synth = createMelodySynth(instrument).toDestination();
    synth.volume.value = -11;
    synthId = instrument;
  }
  return synth;
}

export function setMelody(notes?: TimedNote[], instrument: string = DEFAULT_MELODY_INSTRUMENT) {
  stopMelody();
  if (!notes || notes.length === 0) return;
  const s = ensureSynth(instrument);
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

// Dispose the cached synth and null the singleton so the next setMelody()
// rebuilds it in whatever Tone context is active (offline render / live rebuild).
export function resetMelody() {
  stopMelody();
  try { synth?.dispose(); } catch { /* node from a disposed context */ }
  synth = null;
  synthId = "";
}
