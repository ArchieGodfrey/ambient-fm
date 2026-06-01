import * as Tone from "tone";

export function createTexture() {
  const noise = new Tone.Noise("pink");
  const filter = new Tone.Filter(1000, "bandpass");

  noise.connect(filter).toDestination();
  noise.start();
  noise.volume.value = -100;

  return {
    setIntensity(v: number, brightness = 0.5) {
      const intensity = Math.min(Math.max(v, 0), 1);
      noise.volume.value = intensity > 0.04 ? -70 + intensity * 30 : -100;
      filter.frequency.value = 300 + brightness * 2500;
      filter.Q.value = 1 + intensity * 2;
    },
  };
}
