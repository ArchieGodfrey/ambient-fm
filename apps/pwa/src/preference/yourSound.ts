import type { PreferenceVector } from "./model";
import type { Sound, SoundMood, SoundKey } from "../sounds/types";
import type { StimulusEvent } from "../types";

// Phase 6c — the emergent "Your Sound". A read-only Sound synthesized from the
// long-term preference vector, then coloured by recent stimulus (time / weather
// / a fresh capture) as a fast-moving overlay. Not stored or hand-edited — it's
// recomputed; the user can branch an editable copy.

export const YOUR_SOUND_ID = "__your_sound__";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function parseKey(key: string | null, minorBias: number): SoundKey {
  if (key) {
    const [tonic, ...rest] = key.split(/\s+/);
    return { tonic: tonic || "C", mode: /minor/i.test(rest.join(" ") || key) ? "minor" : "major" };
  }
  return { tonic: "C", mode: minorBias > 0.5 ? "minor" : "major" };
}

export function buildYourSound(pref: PreferenceVector, events: StimulusEvent[]): Sound {
  // Long-term base from preference.
  let energy = pref.energy;
  let brightness = clamp01(1 - pref.minorBias * 0.6);
  const calmness = clamp01(1 - pref.energy);
  const tension = clamp01(pref.minorBias * 0.7);

  // Recent-stimulus overlay.
  const t = events.find((e) => e.source === "time");
  const hour = typeof t?.metadata?.hour === "number" ? t.metadata.hour : new Date().getHours();
  if (hour < 6 || hour >= 21) { energy = clamp01(energy - 0.12); brightness = clamp01(brightness - 0.12); }
  const w = events.find((e) => e.source === "weather");
  if (w && /rain|cloud/i.test(w.label ?? "")) brightness = clamp01(brightness - 0.1);
  const cap = events.filter((e) => e.source === "audio" && Date.now() - e.timestamp < 15 * 60 * 1000).sort((a, b) => b.timestamp - a.timestamp)[0];
  if (cap) energy = clamp01(energy * 0.7 + (cap.strength ?? 0.5) * 0.3);

  const mood: SoundMood = { energy, calmness, tension, brightness };
  const key = parseKey(pref.dominantKey, pref.minorBias);
  const now = Date.now();

  return {
    id: YOUR_SOUND_ID,
    name: "Your Sound",
    mood,
    composerSettings: { complexity: pref.complexity, motifDensity: clamp01(0.4 + pref.complexity * 0.3), harmonicMovement: 0.5 },
    tempo: pref.tempo,
    key,
    progression: key.mode === "minor" ? [0, 5, 3, 6] : [0, 3, 4, 5],
    layers: { drone: pref.layers.drone, pad: pref.layers.pad, pulse: pref.layers.pulse, texture: pref.layers.texture },
    createdAt: now,
    updatedAt: now,
  };
}

// How the recent set differs from the long-term leaning (a rough drift signal).
export function describeDrift(recentEnergy: number | null, longEnergy: number, recentMinor: number | null, longMinor: number): string | null {
  if (recentEnergy == null || recentMinor == null) return null;
  const dE = recentEnergy - longEnergy;
  const dM = recentMinor - longMinor;
  if (Math.abs(dE) < 0.12 && Math.abs(dM) < 0.25) return null;
  const parts: string[] = [];
  if (dE > 0.12) parts.push("more energetic"); else if (dE < -0.12) parts.push("calmer");
  if (dM > 0.25) parts.push("darker"); else if (dM < -0.25) parts.push("brighter");
  return parts.length ? `lately: ${parts.join(", ")}` : null;
}
