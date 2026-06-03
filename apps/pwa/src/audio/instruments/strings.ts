import * as Tone from "tone";
export function createStringsInstrument() {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' as const },
    envelope: { attack: 0.9, decay: 0.3, sustain: 0.85, release: 3 },
  }).toDestination();
  const filter = new Tone.Filter(900, 'lowpass').toDestination();
  synth.disconnect(); synth.connect(filter);
  synth.volume.value = -18;
  return {
    id: 'strings' as const,
    play(note: string, time: Tone.Unit.Time, velocity = 0.5) { synth.triggerAttackRelease(note, '2n', time, velocity); },
    setVolume(v: number) { synth.volume.value = v; },
    dispose() { synth.dispose(); filter.dispose(); },
  };
}
