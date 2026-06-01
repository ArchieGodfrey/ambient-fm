import { createRNG } from "../../utils/randomField";
import type { RNG } from "../../utils/randomField";
export type { RNG } from "../../utils/randomField";

export function getTimeSeed(baseSeed: number, tick: number, context: string): number {
  let hash = baseSeed >>> 0;

  for (let i = 0; i < context.length; i += 1) {
    hash = (hash * 31 + context.charCodeAt(i)) >>> 0;
  }

  return (hash + tick * 10007) >>> 0;
}

export function field(baseSeed: number, tick: number, context: string): RNG {
  return createRNG(getTimeSeed(baseSeed, tick, context));
}

export function getTick(timeSeconds: number, bpm: number): number {
  const secondsPerBeat = 60 / Math.max(1, bpm);
  return Math.floor(timeSeconds / secondsPerBeat);
}

export function shouldEvolve(
  baseSeed: number,
  tick: number,
  context: string,
  probability: number,
): boolean {
  const rng = field(baseSeed, tick, context);
  return rng() < probability;
}

export function choose<T>(rng: RNG, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}
