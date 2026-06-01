import { nanoid } from "nanoid";

export type RNG = () => number;

export function createRNG(seed: number): RNG {
  let state = seed >>> 0;

  return function random() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashStringToUint32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function createSeed(): number {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.getRandomValues === "function") {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    }
    if (typeof crypto.randomUUID === "function") {
      return hashStringToUint32(crypto.randomUUID());
    }
  }

  return hashStringToUint32(nanoid());
}
