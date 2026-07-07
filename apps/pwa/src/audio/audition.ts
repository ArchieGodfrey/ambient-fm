import * as Tone from "tone";

// A lightweight synth for auditioning notes as the user plays the piano — plays
// immediately, independent of the composition runtime, and mixes fine with a
// running soundscape preview. Attack/release let the note sustain while held.
let synth: Tone.PolySynth | null = null;

function ensure() {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.28, sustain: 0.3, release: 0.6 },
    }).toDestination();
    synth.volume.value = -9;
  }
  return synth;
}

export async function auditionAttack(note: string) {
  try {
    await Tone.start(); // the press is a user gesture — resume the context
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
