import * as Tone from "tone";

export function createDrone() {
  const osc = new Tone.Oscillator("C2", "sine");
  const filter = new Tone.Filter(200, "lowpass");

  osc.connect(filter).toDestination();
  osc.volume.value = -100;
  osc.start();

  return {
    setIntensity(v: number) {
      filter.frequency.value = 100 + v * 600;
    },
    setNote(note: string) {
      try {
        osc.frequency.value = Tone.Frequency(note).toFrequency();
      } catch {
        /* keep current pitch */
      }
    },
    dispose() {
      osc.dispose();
      filter.dispose();
    },
  };
}
