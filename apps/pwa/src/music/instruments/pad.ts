import * as Tone from "tone";
import type { Instrument } from "./types";

export function createPadInstrument(): Instrument {
  const synth = new Tone.PolySynth(Tone.Synth).toDestination();

  return {
    id: "pad",

    play(note, time, velocity = 0.5) {
      synth.triggerAttackRelease(note, "2n", time, velocity);
    },

    setVolume(v) {
      synth.volume.value = v;
    },
  };
}
