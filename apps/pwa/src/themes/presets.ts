import type { Sound, SoundMood } from "../sounds/types";
import type { ComposerSettings } from "../features/composer/types";
import { describeMood } from "../sounds/previewPlan";

// Seed themes/genres you can "lean into" from the Radio. Each is a Partial<Sound>,
// so it flows through the existing soundToDirection → composeTrack path unchanged.
// The LLM blends the chosen theme with your emergent "Your Sound" (see
// blendThemeWithYourSound), so a genre still carries a little of your taste.
export type ThemePreset = {
  id: string;
  name: string;
  blurb: string;
  hue: number; // chip accent, aligned with Disc.moodHue
  mood: SoundMood;
  key: NonNullable<Sound["key"]>;
  progression: number[];
  tempo: number;
  layers: NonNullable<Sound["layers"]>;
  composerSettings: ComposerSettings;
  vibe: string;
  fillInstruction: string;
};

export const THEMES: ThemePreset[] = [
  {
    id: "calm", name: "Calm", blurb: "Still and spacious", hue: 200,
    mood: { energy: 0.22, calmness: 0.88, tension: 0.12, brightness: 0.45 },
    key: { tonic: "A", mode: "minor" }, progression: [0, 5, 3, 4], tempo: 66,
    layers: { drone: 0.6, pad: 0.75, pulse: 0.12, texture: 0.4 },
    composerSettings: { complexity: 0.25, motifDensity: 0.25, harmonicMovement: 0.3 },
    vibe: "still water at dawn", fillInstruction: "sparse, long sustained tones, lots of space",
  },
  {
    id: "focus", name: "Focus", blurb: "Quiet momentum", hue: 250,
    mood: { energy: 0.5, calmness: 0.62, tension: 0.2, brightness: 0.5 },
    key: { tonic: "C", mode: "major" }, progression: [0, 4, 5, 3], tempo: 92,
    layers: { drone: 0.3, pad: 0.6, pulse: 0.42, texture: 0.4 },
    composerSettings: { complexity: 0.35, motifDensity: 0.35, harmonicMovement: 0.35 },
    vibe: "a clear desk and a long afternoon", fillInstruction: "steady, minimal, an unobtrusive pulse",
  },
  {
    id: "energised", name: "Energised", blurb: "Bright and driving", hue: 330,
    mood: { energy: 0.85, calmness: 0.2, tension: 0.35, brightness: 0.78 },
    key: { tonic: "E", mode: "major" }, progression: [0, 4, 5, 3], tempo: 122,
    layers: { drone: 0.2, pad: 0.5, pulse: 0.72, texture: 0.5 },
    composerSettings: { complexity: 0.55, motifDensity: 0.7, harmonicMovement: 0.5 },
    vibe: "a sunrise run", fillInstruction: "bright arps and a driving pulse",
  },
  {
    id: "dreamy", name: "Dreamy", blurb: "Weightless and washed", hue: 282,
    mood: { energy: 0.35, calmness: 0.72, tension: 0.2, brightness: 0.62 },
    key: { tonic: "D", mode: "major" }, progression: [0, 3, 5, 4], tempo: 76,
    layers: { drone: 0.5, pad: 0.82, pulse: 0.2, texture: 0.72 },
    composerSettings: { complexity: 0.4, motifDensity: 0.45, harmonicMovement: 0.4 },
    vibe: "floating above the clouds", fillInstruction: "washed reverb, shimmering evolving textures",
  },
  {
    id: "tense", name: "Tense", blurb: "Dark and unresolved", hue: 8,
    mood: { energy: 0.55, calmness: 0.25, tension: 0.82, brightness: 0.3 },
    key: { tonic: "D", mode: "minor" }, progression: [0, 5, 6, 4], tempo: 100,
    layers: { drone: 0.55, pad: 0.5, pulse: 0.5, texture: 0.62 },
    composerSettings: { complexity: 0.6, motifDensity: 0.45, harmonicMovement: 0.55 },
    vibe: "something approaching in the dark", fillInstruction: "dissonant swells that never quite resolve",
  },
  {
    id: "lofi", name: "Lo-fi", blurb: "Warm and mellow", hue: 42,
    mood: { energy: 0.42, calmness: 0.62, tension: 0.28, brightness: 0.5 },
    key: { tonic: "F", mode: "major" }, progression: [1, 4, 0, 5], tempo: 82,
    layers: { drone: 0.3, pad: 0.6, pulse: 0.52, texture: 0.6 },
    composerSettings: { complexity: 0.45, motifDensity: 0.4, harmonicMovement: 0.5 },
    vibe: "a rainy afternoon on tape", fillInstruction: "warm mellow jazzy sevenths with a soft swing",
  },
  {
    id: "neoclassical", name: "Neo-classical", blurb: "Candlelit piano", hue: 250,
    mood: { energy: 0.45, calmness: 0.55, tension: 0.42, brightness: 0.44 },
    key: { tonic: "A", mode: "minor" }, progression: [0, 5, 3, 4], tempo: 84,
    layers: { drone: 0.22, pad: 0.5, pulse: 0.2, texture: 0.42 },
    composerSettings: { complexity: 0.55, motifDensity: 0.5, harmonicMovement: 0.5 },
    vibe: "a candlelit piano at midnight", fillInstruction: "expressive piano-led lines with dynamic swells",
  },
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function lerpMood(a: SoundMood, b: SoundMood, t: number): SoundMood {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    energy: mix(a.energy, b.energy),
    calmness: mix(a.calmness, b.calmness),
    tension: mix(a.tension, b.tension),
    brightness: mix(a.brightness, b.brightness),
  };
}

// ── Lean targets & radio bubbles ──
//
// A "lean target" is anything you can lean the station into: a seed theme, one of
// your saved Sounds, or a suggestion. It carries a display name + hue and the
// Partial<Sound> the radio composes from.
export type LeanTarget = { id: string; name: string; hue: number; sound: Partial<Sound> };
export type RadioBubble = { target: LeanTarget; kind: "suggested" | "mine" | "theme" };

const MOOD_HUE: Record<string, number> = {
  calm: 200, still: 200, slow: 200, focus: 250, focused: 250, tense: 8, dark: 8,
  energ: 330, bright: 330, ambient: 282, dream: 282, warm: 42,
};
export function hueForMood(mood?: SoundMood): number {
  if (!mood) return 248;
  const word = describeMood(mood);
  for (const key of Object.keys(MOOD_HUE)) if (word.includes(key)) return MOOD_HUE[key];
  return 248;
}

function themeSound(t: ThemePreset): Partial<Sound> {
  return {
    name: t.name, mood: t.mood, key: t.key, progression: t.progression, tempo: t.tempo,
    layers: t.layers, composerSettings: t.composerSettings, vibe: t.vibe, fillInstruction: t.fillInstruction,
  };
}
export function themeToLeanTarget(t: ThemePreset): LeanTarget {
  return { id: `theme:${t.id}`, name: t.name, hue: t.hue, sound: themeSound(t) };
}
export function soundToLeanTarget(s: Sound): LeanTarget {
  return { id: `sound:${s.id}`, name: s.name, hue: hueForMood(s.mood), sound: s };
}

// Blend a lean target's mood ~30% toward the listener's emergent sound (when we
// know them), so a genre still feels personal. Structure stays the target's.
export function blendLean(sound: Partial<Sound>, yourSound?: Partial<Sound> | null, confidence = 0): Partial<Sound> {
  if (sound.mood && yourSound?.mood && confidence >= 0.3) {
    return { ...sound, mood: lerpMood(sound.mood, yourSound.mood, 0.3) };
  }
  return sound;
}

// The bubbles orbiting the radio: a time-of-day suggestion, your emergent sound
// (once we know you), your saved sounds, then seed themes — capped so the page
// never needs to scroll.
export function buildRadioBubbles(opts: {
  sounds: Sound[]; yourSound?: Partial<Sound> | null; confidence: number; hour: number;
}): RadioBubble[] {
  const { sounds, yourSound, confidence, hour } = opts;
  const bubbles: RadioBubble[] = [];

  const ctx = hour < 5 || hour >= 22 ? { id: "dreamy", name: "Late night" }
    : hour < 11 ? { id: "focus", name: "Morning focus" }
    : hour < 17 ? { id: "lofi", name: "Afternoon lo-fi" }
    : { id: "calm", name: "Evening wind-down" };
  const ctxTheme = THEMES.find((t) => t.id === ctx.id)!;
  bubbles.push({ kind: "suggested", target: { id: `suggested:${ctx.id}`, name: ctx.name, hue: ctxTheme.hue, sound: themeSound(ctxTheme) } });

  if (yourSound?.mood && confidence >= 0.3) {
    bubbles.push({ kind: "suggested", target: { id: "suggested:yours", name: yourSound.name || "Your sound", hue: hueForMood(yourSound.mood), sound: yourSound } });

    // Adjacent-to-taste: a variation of your sound nudged one way — novelty right
    // next to comfort. Days lean brighter/livelier, evenings softer/calmer.
    const m = yourSound.mood;
    const daytime = hour >= 8 && hour < 18;
    const variation: SoundMood = daytime
      ? { ...m, brightness: clamp01(m.brightness + 0.2), energy: clamp01(m.energy + 0.15), tension: clamp01(m.tension - 0.1) }
      : { ...m, calmness: clamp01(m.calmness + 0.2), energy: clamp01(m.energy - 0.15), brightness: clamp01(m.brightness - 0.1) };
    const vName = daytime ? "Brighter you" : "Softer you";
    bubbles.push({ kind: "suggested", target: { id: "suggested:variation", name: vName, hue: hueForMood(variation), sound: { ...yourSound, name: vName, mood: variation } } });
  }

  for (const s of sounds.slice(0, 3)) bubbles.push({ kind: "mine", target: soundToLeanTarget(s) });

  for (const t of THEMES) {
    if (bubbles.length >= 8) break;
    if (t.id === ctx.id) continue;
    bubbles.push({ kind: "theme", target: themeToLeanTarget(t) });
  }
  return bubbles.slice(0, 8);
}
