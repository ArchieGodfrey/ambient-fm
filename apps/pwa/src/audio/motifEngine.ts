import * as Tone from "tone";
import type { Motif } from "../ai/types";

export function createMotifPlayer(motif: Motif) {
  const synth = new Tone.PolySynth().toDestination();
  let index = 0;

  const loop = new Tone.Loop((time) => {
    const note = motif.notes[index % motif.notes.length];
    const dur = motif.rhythm[index % motif.rhythm.length];

    if (note && typeof dur === "number" && dur > 0) {
      synth.triggerAttackRelease(note, dur, time);
    }

    index += 1;
  }, "1n");

  return {
    start() {
      loop.start(0);
    },

    stop() {
      loop.stop();
      synth.dispose();
    },

    setIntensity(v: number) {
      synth.volume.value = -30 + v * 10;
    },
  };
}
