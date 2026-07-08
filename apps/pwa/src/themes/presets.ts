import type { Sound, SoundMood } from "../sounds/types";
import type { ComposerSettings } from "../features/composer/types";

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

function lerpMood(a: SoundMood, b: SoundMood, t: number): SoundMood {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    energy: mix(a.energy, b.energy),
    calmness: mix(a.calmness, b.calmness),
    tension: mix(a.tension, b.tension),
    brightness: mix(a.brightness, b.brightness),
  };
}

// Turn a theme into the Partial<Sound> the radio composes from, blending its mood
// gently (~30%) toward the listener's emergent "Your Sound" when we know them —
// so the genre leads but still feels personal. Structure (key/progression/tempo/
// layers/vibe) stays the theme's.
export function blendThemeWithYourSound(
  theme: ThemePreset,
  yourSound?: Partial<Sound> | null,
  confidence = 0,
): Partial<Sound> {
  const sound: Partial<Sound> = {
    name: theme.name,
    mood: theme.mood,
    key: theme.key,
    progression: theme.progression,
    tempo: theme.tempo,
    layers: theme.layers,
    composerSettings: theme.composerSettings,
    vibe: theme.vibe,
    fillInstruction: theme.fillInstruction,
  };
  if (yourSound?.mood && confidence >= 0.3) {
    sound.mood = lerpMood(theme.mood, yourSound.mood, 0.3);
  }
  return sound;
}
