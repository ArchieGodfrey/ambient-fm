import * as Tone from "tone";
import type { Instrument } from "./types";

export function createPulseInstrument(): Instrument {
  const synth = new Tone.MonoSynth({
    oscillator: { type: "square" },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.8 },
  }).toDestination();
  synth.volume.value = -20;

  return {
    id: "pulse",

    play(note, time, velocity = 0.5) {
      synth.triggerAttackRelease(note, "8n", time, velocity);
    },

    setIntensity(v) {
      synth.volume.value = -30 + v * 18;
    },
  };
}
