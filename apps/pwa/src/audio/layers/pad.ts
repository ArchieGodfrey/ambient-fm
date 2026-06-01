import * as Tone from "tone";

export function createPad() {
  const synth = new Tone.PolySynth().toDestination();
  synth.volume.value = -100;

  return {
    setIntensity(v: number) {
      synth.volume.value = -30 + v * 10;
    },

    triggerChord() {
      synth.triggerAttackRelease(["C4", "E4", "G4"], "2n");
    },
  };
}
