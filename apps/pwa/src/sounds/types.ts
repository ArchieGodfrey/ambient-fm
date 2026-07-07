import type { ComposerSettings } from "../features/composer/types";

// A personal, evolvable palette — the user's "sound". Saved to Dexie, branchable.
export interface SoundMood {
  energy: number;
  calmness: number;
  tension: number;
  brightness: number;
}

export interface Sound {
  id: string;
  name: string;
  mood: SoundMood;
  composerSettings: ComposerSettings;
  parentId?: string; // lineage: the sound this one was branched from
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_MOOD: SoundMood = { energy: 0.5, calmness: 0.5, tension: 0.3, brightness: 0.5 };
export const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = { complexity: 0.4, motifDensity: 0.4, harmonicMovement: 0.4 };
