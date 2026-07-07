import * as Tone from "tone";
import type { Motif } from "../ai/types";
import { instrumentRegistry } from "./instruments";

const STEP_BEATS = 0.25; // 16th-note grid

// Expand a motif's notes + per-note beat durations into a 16th-note step grid:
// each note triggers on its step, then rests for the remainder of its duration.
// This lets varied rhythms and rests actually play, instead of one note per
// whole-note tick.
function buildSteps(motif: Motif): (string | null)[] {
  const steps: (string | null)[] = [];
  motif.notes.forEach((note, i) => {
    const durBeats = motif.rhythm[i % motif.rhythm.length] || 0.5;
    const n = Math.max(1, Math.round(durBeats / STEP_BEATS));
    steps.push(note);
    for (let k = 1; k < n; k++) steps.push(null);
  });
  return steps.length ? steps : [null];
}

export function createMotifPlayer(motif: Motif) {
  const instrument = instrumentRegistry.get(motif.layer);
  const fallbackSynth = instrument ? null : new Tone.PolySynth().toDestination();
  const steps = buildSteps(motif);
  let index = 0;

  const loop = new Tone.Loop((time) => {
    const note = steps[index % steps.length];
    if (note) {
      if (instrument) instrument.play(note, time, 0.5);
      else fallbackSynth?.triggerAttackRelease(note, "8n", time, 0.5);
    }
    index += 1;
  }, "16n");

  return {
    start() {
      loop.start(0);
    },
    stop() {
      loop.stop();
      if (fallbackSynth) fallbackSynth.dispose();
    },
    setIntensity(v: number) {
      if (instrument) instrument.setIntensity(v);
    },
  };
}
