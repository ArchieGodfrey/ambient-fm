import * as Tone from "tone";

export function createTexture() {
  const noise = new Tone.Noise("pink");
  const filter = new Tone.Filter(1000, "bandpass");

  noise.connect(filter).toDestination();
  noise.start();
  noise.volume.value = -100;

  return {
    setIntensity(v: number) {
      noise.volume.value = -50 + v * 20;
      filter.frequency.value = 500 + v * 4000;
    },
  };
}
