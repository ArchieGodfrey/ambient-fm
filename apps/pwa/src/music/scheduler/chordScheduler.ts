import type { Chord } from "../types";

export class ChordScheduler {
  private progression: Chord[];

  constructor(progression: Chord[]) {
    this.progression = progression;
  }

  getCurrentChord(elapsedSeconds: number) {
    const index = Math.floor(elapsedSeconds / 16) % this.progression.length;
    return this.progression[index];
  }
}
