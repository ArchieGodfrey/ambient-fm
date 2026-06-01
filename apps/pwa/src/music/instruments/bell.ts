import * as Tone from "tone";
import type { Instrument } from "./types";

export function createBellInstrument(): Instrument {
  const synth = new Tone.PolySynth(Tone.FMSynth).toDestination();

  return {
    id: "bell",

    play(note, time, velocity = 0.5) {
      synth.triggerAttackRelease(note, "8n", time, velocity);
    },

    setVolume(v) {
      synth.volume.value = v;
    },
  };
}
