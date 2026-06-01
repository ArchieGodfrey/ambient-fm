import * as Tone from "tone";
import type { Motif } from "../ai/types";
import { instrumentRegistry } from "./instruments";

export function createMotifPlayer(motif: Motif) {
  const instrument = instrumentRegistry.get(motif.layer);
  let index = 0;

  const fallbackSynth = instrument ? null : new Tone.PolySynth().toDestination();
  const loop = new Tone.Loop((time) => {
    const note = motif.notes[index % motif.notes.length];
    const dur = motif.rhythm[index % motif.rhythm.length];

    if (note && typeof dur === "number" && dur > 0) {
      if (instrument) {
        instrument.play(note, time, 0.5);
      } else if (fallbackSynth) {
        fallbackSynth.triggerAttackRelease(note, dur, time, 0.5);
      }
    }

    index += 1;
  }, "1n");

  return {
    start() {
      loop.start(0);
    },

    stop() {
      loop.stop();
      if (fallbackSynth) {
        fallbackSynth.dispose();
      }
    },

    setIntensity(v: number) {
      if (instrument) {
        instrument.setIntensity(v);
      }
    },
  };
}
