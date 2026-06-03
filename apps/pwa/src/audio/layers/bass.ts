import * as Tone from "tone";
import { getScale } from "../../music/harmony/index";
import type { CompositionPlan, CompositionSection } from "../../ai/types";

/** Strip the octave number from a note string like "A3" → "A", "D#4" → "D#" */
function noteName(n: string): string {
  return n.replace(/\d+$/, "");
}

/** Get the chord tones for the active section from its motif */
function getChordNotes(plan: CompositionPlan, section: CompositionSection): string[] {
  const phraseId = section.phraseIds?.[0];
  const phrase = plan.phrases?.find(p => p.id === phraseId);
  const motifId = phrase?.motifs?.[0];
  const motif = plan.motifs?.find(m => m.id === motifId);
  return motif?.notes ?? [];
}

export class BassLayer {
  private synth: Tone.MonoSynth;
  private reverb: Tone.Reverb;
  private scheduled: number[] = [];
  private _enabled = true;

  constructor() {
    this.reverb = new Tone.Reverb({ decay: 1.2, wet: 0.2 });
    this.synth = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" as const },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 1.2 },
      filterEnvelope: {
        attack: 0.02, decay: 0.4, sustain: 0.3, release: 1.5,
        baseFrequency: 120, octaves: 3,
      },
      filter: { Q: 3, type: "lowpass" as const, rolloff: -24 as const },
    });
    this.synth.connect(this.reverb);
    this.reverb.toDestination();
    this.synth.volume.value = -10;
  }

  playBassLine(plan: CompositionPlan, section: CompositionSection): void {
    if (!this._enabled) return;
    this.clearScheduled();

    const bassType = plan.bassType ?? this.deriveBassType(section);
    if (bassType === "none" || section.intensity < 0.2) return;

    // Get chord tones for THIS section — follows chord changes, not just the key root
    const chordNotes = getChordNotes(plan, section);
    const parts = plan.key.trim().split(/\s+/);
    const tonic = parts[0] ?? "C";
    const mode = (parts[1] === "major" ? "major" : "minor") as "major" | "minor";
    const scale = getScale(tonic, mode);

    // Bass note = chord root (from motif) at octave 2, fallback to scale root
    const root = chordNotes.length > 0 ? `${noteName(chordNotes[0])}2` : `${scale[0]}2`;
    const third = chordNotes.length > 1 ? `${noteName(chordNotes[1])}2` : `${scale[2]}2`;
    const fifth = chordNotes.length > 2 ? `${noteName(chordNotes[2])}2` : `${scale[4]}2`;

    const secPerBeat = 60 / plan.bpm;
    const velocity = 0.45 + section.intensity * 0.3;
    this.synth.volume.value = -12 + section.intensity * 5;

    let pattern: Array<{ note: string; dur: string; offset: number }> = [];

    if (bassType === "sparse") {
      // Long root note with occasional fifth — anchors the harmony
      pattern = [
        { note: root, dur: "2n", offset: 0 },
        { note: fifth, dur: "2n", offset: secPerBeat * 2 },
        { note: root, dur: "1n", offset: secPerBeat * 4 },
      ];
    } else if (bassType === "walking") {
      // Quarter-note walk through chord tones
      pattern = [
        { note: root, dur: "4n", offset: 0 },
        { note: third, dur: "4n", offset: secPerBeat },
        { note: fifth, dur: "4n", offset: secPerBeat * 2 },
        { note: third, dur: "4n", offset: secPerBeat * 3 },
        { note: root, dur: "4n", offset: secPerBeat * 4 },
        { note: fifth, dur: "4n", offset: secPerBeat * 5 },
        { note: third, dur: "4n", offset: secPerBeat * 6 },
        { note: root, dur: "4n", offset: secPerBeat * 7 },
      ];
    } else if (bassType === "pulse") {
      // Syncopated eighth-note pattern anchored on root
      const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map(b => b * secPerBeat);
      pattern = beats.map((offset, i) => ({
        note: i === 0 || i === 4 ? root : i % 2 === 0 ? fifth : root,
        dur: "8n",
        offset,
      }));
    }

    for (const { note, dur, offset } of pattern) {
      const id = Tone.Transport.scheduleOnce((time) => {
        this.synth.triggerAttackRelease(note, dur, time, velocity);
      }, `+${(offset + 0.05).toFixed(3)}`);
      this.scheduled.push(id);
    }
  }

  private deriveBassType(section: CompositionSection): string {
    if (section.intensity < 0.3) return "sparse";
    if (section.mood === "energised") return "pulse";
    if (section.mood === "focused") return "walking";
    if (section.mood === "tense") return "walking";
    return "sparse";
  }

  clearScheduled(): void {
    for (const id of this.scheduled) Tone.Transport.clear(id);
    this.scheduled = [];
  }

  set enabled(v: boolean) { this._enabled = v; if (!v) this.clearScheduled(); }

  dispose(): void { this.clearScheduled(); this.synth.dispose(); this.reverb.dispose(); }
}

let instance: BassLayer | null = null;
export function getBassLayer(): BassLayer {
  if (!instance) instance = new BassLayer();
  return instance;
}
