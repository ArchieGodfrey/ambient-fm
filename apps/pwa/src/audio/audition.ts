import * as Tone from "tone";
import { createMelodySynth, DEFAULT_MELODY_INSTRUMENT } from "./melodyInstruments";

// Synth for auditioning notes as the user plays the piano — plays immediately,
// independent of the composition runtime. Attack/release let notes sustain while
// held. Matches the currently-selected melody instrument.
let synth: Tone.PolySynth | null = null;
let currentId = DEFAULT_MELODY_INSTRUMENT as string;

function ensure() {
  if (!synth) {
    synth = createMelodySynth(currentId).toDestination();
    synth.volume.value = -9;
  }
  return synth;
}

export function setAuditionInstrument(id: string) {
  if (id === currentId && synth) return;
  currentId = id;
  if (synth) {
    synth.dispose();
    synth = null;
  }
}

export async function auditionAttack(note: string) {
  try {
    await Tone.start();
    ensure().triggerAttack(note);
  } catch {
    /* no gesture yet — ignore */
  }
}

export function auditionRelease(note: string) {
  try {
    synth?.triggerRelease(note);
  } catch {
    /* ignore */
  }
}
