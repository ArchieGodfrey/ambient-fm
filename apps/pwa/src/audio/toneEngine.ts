import * as Tone from "tone";

let started = false;

export async function startAudio() {
  if (!started) {
    await Tone.start();
    started = true;
  }

  const synth = new Tone.Synth().toDestination();
  synth.triggerAttackRelease("C4", "8n");
}
