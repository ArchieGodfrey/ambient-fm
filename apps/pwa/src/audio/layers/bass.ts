import * as Tone from "tone";
import { getScale } from "../../music/harmony/index";
import type { CompositionPlan, CompositionSection } from "../../ai/types";

export class BassLayer {
  private synth: Tone.MonoSynth;
  private reverb: Tone.Reverb;
  private scheduled: number[] = [];
  private _enabled = true;

  constructor() {
    this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0.25 });
    this.synth = new Tone.MonoSynth({
      oscillator: { type: "triangle" as const },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 1.5 },
      filterEnvelope: { attack: 0.05, decay: 0.5, sustain: 0.4, release: 2, baseFrequency: 200, octaves: 2.5 },
    });
    this.synth.connect(this.reverb);
    this.reverb.toDestination();
    this.synth.volume.value = -12;
  }

  playBassLine(plan: CompositionPlan, section: CompositionSection): void {
    if (!this._enabled) return;
    this.clearScheduled();

    const bassType = plan.bassType ?? this.deriveBassType(section);
    if (bassType === "none" || section.intensity < 0.25) return;

    const parts = plan.key.trim().split(/\s+/);
    const tonic = parts[0] ?? "C";
    const mode = (parts[1] === "major" ? "major" : "minor") as "major" | "minor";
    const scale = getScale(tonic, mode);

    const secPerBeat = 60 / plan.bpm;
    const rootNote = `${scale[0]}2`;
    const fifthNote = `${scale[4]}2`;

    const velocity = 0.4 + section.intensity * 0.35;
    this.synth.volume.value = -14 + section.intensity * 6;

    let pattern: Array<{ note: string; dur: string; offset: number }> = [];

    if (bassType === "sparse") {
      pattern = [
        { note: rootNote, dur: "2n", offset: 0 },
        { note: fifthNote, dur: "2n", offset: secPerBeat * 2 },
      ];
    } else if (bassType === "walking") {
      const walkNotes = [scale[0], scale[2], scale[4], scale[2]].map((n) => `${n}2`);
      pattern = walkNotes.map((note, i) => ({ note, dur: "4n", offset: i * secPerBeat }));
    } else if (bassType === "pulse") {
      pattern = Array.from({ length: 8 }, (_, i) => ({
        note: i % 4 === 0 ? rootNote : i % 2 === 0 ? fifthNote : rootNote,
        dur: "8n",
        offset: i * secPerBeat * 0.5,
      }));
    }

    for (const { note, dur, offset } of pattern) {
      const id = Tone.Transport.scheduleOnce((time) => {
        this.synth.triggerAttackRelease(note, dur, time, velocity);
      }, `+${(offset + 0.1).toFixed(3)}`);
      this.scheduled.push(id);
    }
  }

  private deriveBassType(section: CompositionSection): string {
    if (section.intensity < 0.3) return "sparse";
    if (section.mood === "energised") return "pulse";
    if (section.mood === "focused") return "walking";
    return "sparse";
  }

  clearScheduled(): void {
    for (const id of this.scheduled) Tone.Transport.clear(id);
    this.scheduled = [];
  }

  set enabled(v: boolean) {
    this._enabled = v;
    if (!v) this.clearScheduled();
  }

  dispose(): void {
    this.clearScheduled();
    this.synth.dispose();
    this.reverb.dispose();
  }
}

let instance: BassLayer | null = null;
export function getBassLayer(): BassLayer {
  if (!instance) instance = new BassLayer();
  return instance;
}
