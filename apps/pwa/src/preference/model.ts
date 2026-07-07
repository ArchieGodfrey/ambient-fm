import type { SessionSummary } from "../memory/types";
import type { Feedback } from "../feedback/types";

// Phase 6b — the preference model. Blends what you've MADE (long-term track
// analysis) with what you've LIKED (feedback), weighting each track by its net
// feedback so liked/completed tracks pull harder and disliked ones fade.

export interface PreferenceVector {
  energy: number;      // 0..1
  complexity: number;  // 0..1
  tempo: number;       // bpm
  minorBias: number;   // 0..1 (fraction leaning minor)
  layers: { drone: number; pad: number; texture: number; pulse: number };
  topMoods: { label: string; score: number }[];
  topKeys: { label: string; score: number }[];
  dominantMood: string | null;
  dominantKey: string | null;
  confidence: number;  // 0..1 — how much history backs this
  sampleSize: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const NEUTRAL_PREFERENCE: PreferenceVector = {
  energy: 0.5, complexity: 0.4, tempo: 80, minorBias: 0.5,
  layers: { drone: 0.4, pad: 0.6, texture: 0.5, pulse: 0.3 },
  topMoods: [], topKeys: [], dominantMood: null, dominantKey: null, confidence: 0, sampleSize: 0,
};

export function computePreference(sessions: SessionSummary[], feedback: Feedback[]): PreferenceVector {
  if (!sessions.length) return { ...NEUTRAL_PREFERENCE };

  // Net feedback weight per track.
  const fbScore = new Map<string, number>();
  for (const f of feedback) fbScore.set(f.sessionId, (fbScore.get(f.sessionId) ?? 0) + f.weight);

  let totalW = 0;
  let energy = 0, complexity = 0, tempo = 0, minor = 0;
  const layers = { drone: 0, pad: 0, texture: 0, pulse: 0 };
  const moods = new Map<string, number>();
  const keys = new Map<string, number>();

  for (const s of sessions) {
    // Base 1 for everything you've made; feedback pushes it up (liked) or down.
    const w = Math.min(3, Math.max(0.1, 1 + (fbScore.get(s.id) ?? 0)));
    totalW += w;
    energy += (s.avgEnergy ?? 0.5) * w;
    complexity += clamp01(s.plan?.intent?.complexity ?? s.plan?.texture?.brightness ?? 0.4) * w;
    tempo += (s.avgBpm ?? 80) * w;
    minor += (/minor/i.test(s.key ?? "") ? 1 : 0) * w;
    const lp = s.layerProfile ?? { drone: 0.4, pad: 0.6, texture: 0.5, pulse: 0.3 };
    layers.drone += lp.drone * w; layers.pad += lp.pad * w; layers.texture += lp.texture * w; layers.pulse += lp.pulse * w;
    if (s.dominantMood) moods.set(s.dominantMood, (moods.get(s.dominantMood) ?? 0) + w);
    if (s.key) keys.set(s.key, (keys.get(s.key) ?? 0) + w);
  }

  const rank = (m: Map<string, number>) =>
    [...m.entries()].map(([label, score]) => ({ label, score })).sort((a, b) => b.score - a.score);
  const rankedMoods = rank(moods);
  const rankedKeys = rank(keys);

  const explicitCount = feedback.filter((f) => f.signal === "like" || f.signal === "dislike").length;
  const confidence = clamp01(sessions.length / 12 * 0.6 + explicitCount / 8 * 0.4);

  return {
    energy: clamp01(energy / totalW),
    complexity: clamp01(complexity / totalW),
    tempo: Math.round(tempo / totalW),
    minorBias: clamp01(minor / totalW),
    layers: { drone: clamp01(layers.drone / totalW), pad: clamp01(layers.pad / totalW), texture: clamp01(layers.texture / totalW), pulse: clamp01(layers.pulse / totalW) },
    topMoods: rankedMoods.slice(0, 3),
    topKeys: rankedKeys.slice(0, 3),
    dominantMood: rankedMoods[0]?.label ?? null,
    dominantKey: rankedKeys[0]?.label ?? null,
    confidence,
    sampleSize: sessions.length,
  };
}

// A short human description of the leaning, for the UI.
export function describePreference(p: PreferenceVector): string {
  if (p.sampleSize === 0) return "No history yet — burn and react to a few tracks.";
  const bits: string[] = [];
  if (p.dominantMood) bits.push(p.dominantMood);
  bits.push(p.minorBias > 0.6 ? "minor keys" : p.minorBias < 0.4 ? "major keys" : "mixed keys");
  bits.push(p.tempo < 75 ? "slow" : p.tempo > 105 ? "upbeat" : "mid-tempo");
  bits.push(p.complexity > 0.6 ? "intricate" : p.complexity < 0.35 ? "spare" : "balanced");
  return bits.join(" · ");
}
