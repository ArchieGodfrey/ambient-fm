import * as Tone from "tone";
export function createElectricPianoInstrument() {
  const synth = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 3.999,
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.25, release: 2 },
    modulation: { type: 'square' as const },
    modulationEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.25, release: 2 },
  }).toDestination();
  synth.volume.value = -16;
  return {
    id: 'electric_piano' as const,
    play(note: string, time: Tone.Unit.Time, velocity = 0.6) { synth.triggerAttackRelease(note, '4n', time, velocity); },
    setVolume(v: number) { synth.volume.value = v; },
    dispose() { synth.dispose(); },
  };
}
