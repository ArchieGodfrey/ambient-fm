import type { ComposerSettings } from "../features/composer/types";

// A personal, evolvable palette — the user's "sound". Saved to Dexie, branchable.
export interface SoundMood {
  energy: number;
  calmness: number;
  tension: number;
  brightness: number;
}

export interface SoundKey {
  tonic: string;
  mode: "major" | "minor";
}

export interface SoundLayers {
  drone: number;
  pad: number;
  pulse: number;
  texture: number;
}

export interface Sound {
  id: string;
  name: string;
  mood: SoundMood;
  composerSettings: ComposerSettings;
  // Musical direction the user shapes in the Studio. All optional — the
  // soundscape builder extrapolates sensible defaults from mood when absent.
  tempo?: number;         // bpm
  key?: SoundKey;
  progression?: number[]; // chord scale-degrees (0-6)
  layers?: SoundLayers;   // per-layer levels 0..1
  melody?: string[];      // tapped melody as note names (e.g. "C4", "E4")
  parentId?: string;      // lineage: the sound this one was branched from
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_MOOD: SoundMood = { energy: 0.5, calmness: 0.5, tension: 0.3, brightness: 0.5 };
export const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = { complexity: 0.4, motifDensity: 0.4, harmonicMovement: 0.4 };
export const DEFAULT_KEY: SoundKey = { tonic: "C", mode: "major" };
export const DEFAULT_PROGRESSION = [0, 3, 4, 5];
export const DEFAULT_LAYERS: SoundLayers = { drone: 0.5, pad: 0.5, pulse: 0.3, texture: 0.4 };
export const TONICS = ["C", "D", "E", "F", "G", "A", "B"];
