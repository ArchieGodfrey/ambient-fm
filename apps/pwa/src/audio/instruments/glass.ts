import * as Tone from "tone";
export function createGlassInstrument() {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 8, modulationIndex: 1,
    envelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 3 },
    modulation: { type: 'sine' as const },
    modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 1 },
  }).toDestination();
  synth.volume.value = -20;
  return {
    id: 'glass' as const,
    play(note: string, time: Tone.Unit.Time, velocity = 0.5) { synth.triggerAttackRelease(note, '2n', time, velocity); },
    setVolume(v: number) { synth.volume.value = v; },
    dispose() { synth.dispose(); },
  };
}
