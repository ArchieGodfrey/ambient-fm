import * as Tone from "tone";
import type { Instrument } from "./types";

export function createTextureInstrument(): Instrument {
  const synth = new Tone.FMSynth({
    modulationIndex: 12,
    harmonicity: 3,
    envelope: { attack: 0.5, decay: 1, sustain: 0.4, release: 2 },
    modulation: { type: "sine" },
  }).toDestination();
  synth.volume.value = -24;

  return {
    id: "texture",

    play(note, time, velocity = 0.4) {
      synth.triggerAttackRelease(note, "1n", time, velocity);
    },

    setIntensity(v) {
      synth.volume.value = -34 + v * 20;
    },
  };
}
