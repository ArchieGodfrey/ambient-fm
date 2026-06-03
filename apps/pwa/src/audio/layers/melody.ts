import * as Tone from "tone";
import { getScale } from "../../music/harmony/index";
import type { CompositionPlan, CompositionSection } from "../../ai/types";
import { field } from "../../music/random/randomField";
import { getInstrument, type InstrumentId } from "../instruments/instrumentFactory";

export class MelodyLayer {
  private reverb = new Tone.Reverb({ decay: 3, wet: 0.45 });
  private volume = new Tone.Volume(-10);
  private scheduled: number[] = [];
  private _enabled = true;

  constructor() {
    this.reverb.connect(this.volume);
    this.volume.toDestination();
  }

  async playPhrase(
    plan: CompositionPlan,
    section: CompositionSection,
    cursor: number,
  ): Promise<void> {
    if (!this._enabled || section.intensity < 0.15) return;
    this.clearScheduled();

    // Determine which instruments to use for this section
    const sectionInstruments = section.melodyInstruments ??
      (plan.melodyInstrument && plan.melodyInstrument !== 'ai' ? [plan.melodyInstrument] : ['piano']);

    // Get the full scale for melodic movement
    const parts = plan.key.trim().split(/\s+/);
    const tonic = parts[0] ?? "C";
    const mode = (parts[1] === "major" ? "major" : "minor") as "major" | "minor";
    const scale = getScale(tonic, mode);

    // Generate phrase using seeded RNG (deterministic per section+cursor)
    const rng = field(plan.seed, Math.floor(cursor), "melody");
    const octave = section.mood === "tense" || section.mood === "energised" ? 5 : 4;
    const phraseLen = 5 + Math.floor(section.intensity * 4); // 5-9 notes
    const baseVelocity = 0.2 + section.intensity * 0.45;
    const delayStart = (60 / plan.bpm) * 0.5;

    // Build phrase once, play on all instruments
    let pos = Math.floor(rng() * scale.length);
    const phraseNotes: Array<{ note: string; dur: string; offset: number }> = [];
    let timeOffset = 0;

    for (let i = 0; i < phraseLen; i++) {
      const r = rng();
      if (r < 0.45) pos = Math.max(0, pos - 1);
      else if (r < 0.82) pos = Math.min(scale.length - 1, pos + 1);
      else if (r < 0.91) pos = Math.max(0, pos - 2);
      else pos = Math.min(scale.length - 1, pos + 2);

      const noteOct =
        rng() < 0.15 ? (rng() < 0.5 ? octave - 1 : octave + 1) : octave;
      const durStr = rng() < 0.55 ? "4n" : rng() < 0.8 ? "8n" : "2n";
      phraseNotes.push({ note: `${scale[pos]}${noteOct}`, dur: durStr, offset: timeOffset });
      timeOffset += Tone.Time(durStr).toSeconds();
    }

    // Play each instrument
    for (const instrId of sectionInstruments) {
      const inst = await getInstrument(instrId as InstrumentId).catch(() => null);
      if (!inst) continue;

      try { (inst as any).disconnect?.(); } catch { /* ignore */ }
      (inst as any).connect?.(this.reverb);

      // Volume: primary instrument loudest, additional ones softer
      const isPrimary = instrId === sectionInstruments[0];
      const vol = -18 + section.intensity * 12 + (isPrimary ? 0 : -6);
      this.volume.volume.value = vol;

      for (const { note, dur, offset } of phraseNotes) {
        const velocity = baseVelocity * (0.8 + rng() * 0.4);
        const startAt = `+${(delayStart + offset).toFixed(3)}`;
        const id = Tone.Transport.scheduleOnce((time) => {
          (inst as any).triggerAttackRelease?.(note, dur, time, velocity);
          (inst as any).play?.(note, time, velocity);
        }, startAt);
        this.scheduled.push(id);
      }
    }
  }

  clearScheduled(): void {
    for (const id of this.scheduled) Tone.Transport.clear(id);
    this.scheduled = [];
  }

  set enabled(v: boolean) {
    this._enabled = v;
    if (!v) this.clearScheduled();
  }
  get enabled() {
    return this._enabled;
  }

  dispose(): void {
    this.clearScheduled();
    this.reverb.dispose();
    this.volume.dispose();
  }
}

let instance: MelodyLayer | null = null;
export function getMelodyLayer(): MelodyLayer {
  if (!instance) instance = new MelodyLayer();
  return instance;
}
