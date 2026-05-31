import * as Tone from "tone";

let started = false;
let playing = false;
let synth: Tone.Synth | null = null;
let filter: Tone.Filter | null = null;
let reverb: Tone.Reverb | null = null;

export async function startAudio() {
  if (!started) {
    await Tone.start();
    started = true;

    filter = new Tone.Filter(800, "lowpass").toDestination();
    reverb = new Tone.Reverb(3).connect(filter);
    reverb.wet.value = 0.4;

    synth = new Tone.Synth().connect(reverb);
    new Tone.Loop((time) => {
      synth?.triggerAttackRelease("C4", "8n", time);
    }, "4n").start(0);
  }

  if (!playing) {
    if (Tone.Transport.state !== "started") {
      Tone.Transport.start();
    }
    playing = true;
  }
}

export function stopAudio() {
  if (Tone.Transport.state === "started") {
    Tone.Transport.stop();
  }

  playing = false;
}

export function updateAudio(state: {
  bpm: number;
  filterCutoff: number;
  reverbMix: number;
}) {
  if (!filter || !reverb) return;

  filter.frequency.value = state.filterCutoff;
  Tone.Transport.bpm.value = state.bpm;
  reverb.wet.value = Math.min(Math.max(state.reverbMix, 0), 1);
}
