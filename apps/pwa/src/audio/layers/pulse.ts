import * as Tone from "tone";

export function createPulse() {
  const synth = new Tone.MembraneSynth().toDestination();
  let note = "C2"; // retuned to the song's key so the pulse doesn't clash

  const loop = new Tone.Loop((time) => {
    synth.triggerAttackRelease(note, "8n", time);
  }, "2n");

  return {
    setIntensity(v: number) {
      loop.probability = v;
    },

    // Follow the composition's key instead of a fixed C3 (which fit no non-C song).
    setNote(n: string) {
      note = n;
    },

    start() {
      loop.start(0);
    },
  };
}
