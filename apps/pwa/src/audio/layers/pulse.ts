import * as Tone from "tone";

export function createPulse() {
  const synth = new Tone.MembraneSynth().toDestination();

  const loop = new Tone.Loop((time) => {
    synth.triggerAttackRelease("C3", "8n", time);
  }, "2n");

  return {
    setIntensity(v: number) {
      loop.probability = v;
    },

    start() {
      loop.start(0);
    },
  };
}
