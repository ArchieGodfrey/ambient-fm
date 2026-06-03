import * as Tone from "tone";
export function createMarimbaInstrument() {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 5, modulationIndex: 2,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.8 },
    modulation: { type: 'square' as const },
    modulationEnvelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2 },
  }).toDestination();
  synth.volume.value = -14;
  return {
    id: 'marimba' as const,
    play(note: string, time: Tone.Unit.Time, velocity = 0.7) { synth.triggerAttackRelease(note, '8n', time, velocity); },
    setVolume(v: number) { synth.volume.value = v; },
    dispose() { synth.dispose(); },
  };
}
