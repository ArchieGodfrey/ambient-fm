import type { RNG } from "../music/random/randomField";

export function decideNextAction(rng: RNG) {
  const roll = rng();

  if (roll < 0.15) {
    return "advanceChord" as const;
  }

  if (roll < 0.35) {
    return "evolveDensity" as const;
  }

  if (roll < 0.55) {
    return "adjustChordTiming" as const;
  }

  if (roll < 0.75) {
    return "addInstrument" as const;
  }

  return "nothing" as const;
}
