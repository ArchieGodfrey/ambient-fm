import * as Tone from "tone";

// A lightweight synth for auditioning notes as the user taps the piano — plays
// immediately, independent of the composition runtime, and mixes fine with a
// running soundscape preview.
let synth: Tone.PolySynth | null = null;

export async function auditionNote(note: string) {
  try {
    await Tone.start(); // the tap is a user gesture — resume the context
    if (!synth) {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.28, sustain: 0.18, release: 0.7 },
      }).toDestination();
      synth.volume.value = -9;
    }
    synth.triggerAttackRelease(note, "8n");
  } catch {
    // no gesture yet / context unavailable — silently ignore
  }
}
