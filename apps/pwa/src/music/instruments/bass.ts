import * as Tone from "tone";
import type { Instrument } from "./types";

export function createBassInstrument(): Instrument {
  const synth = new Tone.MonoSynth({
    oscillator: { type: "square" },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 1 },
  }).toDestination();

  return {
    id: "bass",

    play(note, time, velocity = 0.7) {
      synth.triggerAttackRelease(note, "4n", time, velocity);
    },

    setVolume(v) {
      synth.volume.value = v;
    },
  };
}
