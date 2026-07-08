import * as Tone from "tone";
import type { Instrument } from "./types";

export function createPadInstrument(): Instrument {
  const synth = new Tone.PolySynth(Tone.Synth).toDestination();
  synth.volume.value = -18;

  return {
    id: "pad",

    play(note, time, velocity = 0.5) {
      synth.triggerAttackRelease(note, "2n", time, velocity);
    },

    setIntensity(v) {
      synth.volume.value = -30 + v * 15;
    },

    dispose() {
      synth.dispose();
    },
  };
}
