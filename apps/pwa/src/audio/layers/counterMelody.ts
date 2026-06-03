import * as Tone from 'tone';
import { getScale } from '../../music/harmony/index';
import type { CompositionPlan, CompositionSection } from '../../ai/types';
import { field } from '../../music/random/randomField';
import { getInstrument, type InstrumentId } from '../instruments/instrumentFactory';

export class CounterMelodyLayer {
  private reverb = new Tone.Reverb({ decay: 4, wet: 0.6 });
  private volume = new Tone.Volume(-18);
  private scheduled: number[] = [];
  private _enabled = true;

  constructor() {
    this.reverb.connect(this.volume);
    this.volume.toDestination();
  }

  async playPhrase(plan: CompositionPlan, section: CompositionSection, cursor: number): Promise<void> {
    if (!this._enabled || section.intensity < 0.3) return;
    this.clearScheduled();

    // Countermelody uses a slow, complementary instrument
    // Prefer strings or glass; fall back to piano
    const sectionInstruments = section.melodyInstruments ?? [];
    const melodyInstr = sectionInstruments[0] ?? plan.melodyInstrument ?? 'piano';
    // Use a different instrument than the melody for contrast
    const counterInstrId: InstrumentId =
      melodyInstr === 'strings' ? 'glass' :
      melodyInstr === 'piano' ? 'strings' :
      melodyInstr === 'marimba' ? 'electric_piano' : 'strings';

    const inst = await getInstrument(counterInstrId).catch(() => null);
    if (!inst) return;
    try { (inst as any).disconnect?.(); } catch {}
    (inst as any).connect?.(this.reverb);

    const parts = plan.key.trim().split(/\s+/);
    const tonic = parts[0] ?? 'C';
    const mode = (parts[1] === 'major' ? 'major' : 'minor') as 'major' | 'minor';
    const scale = getScale(tonic, mode);

    // Countermelody lives in octave 3 (lower than main melody's 4)
    const octave = 3;
    const rng = field(plan.seed + 999, Math.floor(cursor), 'counter');
    const secPerBeat = 60 / plan.bpm;

    // 3-5 slow notes, mostly half-notes, entering after 1 bar
    const phraseLen = 3 + Math.floor(section.intensity * 2);
    const barDelay = secPerBeat * 4; // 1 bar delay
    const velocity = 0.2 + section.intensity * 0.25;

    // Complementary motion: start near the top of the scale and descend
    let pos = Math.floor(scale.length * 0.7 + rng() * scale.length * 0.3);
    let timeOffset = 0;

    for (let i = 0; i < phraseLen; i++) {
      const r = rng();
      // Favour downward movement for countermelody (complementary to melody which tends up)
      if (r < 0.55) pos = Math.max(0, pos - 1);
      else if (r < 0.75) pos = Math.max(0, pos - 2);
      else if (r < 0.9) pos = Math.min(scale.length - 1, pos + 1);
      else pos = Math.min(scale.length - 1, pos + 2);

      const note = `${scale[pos]}${octave}`;
      const durStr = rng() < 0.6 ? '2n' : '1n'; // slower notes
      const startAt = `+${(barDelay + timeOffset).toFixed(3)}`;

      const id = Tone.Transport.scheduleOnce((time) => {
        (inst as any).triggerAttackRelease?.(note, durStr, time, velocity);
        (inst as any).play?.(note, time, velocity);
      }, startAt);
      this.scheduled.push(id);
      timeOffset += Tone.Time(durStr).toSeconds();
    }

    this.volume.volume.value = -20 + section.intensity * 8;
  }

  clearScheduled(): void {
    for (const id of this.scheduled) Tone.Transport.clear(id);
    this.scheduled = [];
  }

  set enabled(v: boolean) { this._enabled = v; if (!v) this.clearScheduled(); }
  dispose(): void { this.clearScheduled(); this.reverb.dispose(); this.volume.dispose(); }
}

let instance: CounterMelodyLayer | null = null;
export function getCounterMelodyLayer(): CounterMelodyLayer {
  if (!instance) instance = new CounterMelodyLayer();
  return instance;
}
