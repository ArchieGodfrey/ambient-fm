import { create } from "zustand";
import type { StimulusEvent } from "../types";
import type { CompositionPlan } from "../ai/types";
import type { ComposerSettings } from "../features/composer/types";

interface AppState {
  events: StimulusEvent[];
  setEvents: (events: StimulusEvent[]) => void;
  addEvent: (event: StimulusEvent) => void;
  currentPlan: CompositionPlan | null;
  currentIsPlaying: boolean;
  isPlaying: boolean;
  currentSessionStatus: string;
  playToggle: (() => Promise<void> | void) | null;
  composerSettings: ComposerSettings;
  setComposerSettings: (settings: ComposerSettings) => void;
  setCurrentPlan: (plan: CompositionPlan | null) => void;
  setIsPlaying: (value: boolean) => void;
  setCurrentSessionStatus: (status: string) => void;
  setPlayToggle: ((toggle: (() => Promise<void> | void) | null) => void);
}

const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = {
  complexity: 0.4,
  motifDensity: 0.4,
  harmonicMovement: 0.4,
};

export const useAppStore = create<AppState>((set) => ({
  events: [],
  currentPlan: null,
  currentIsPlaying: false,
  isPlaying: false,
  currentSessionStatus: "Ready",
  playToggle: null,
  composerSettings: DEFAULT_COMPOSER_SETTINGS,

  setEvents: (events) => set({ events }),
  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events]
    })),
  setComposerSettings: (composerSettings) => set({ composerSettings }),

  setCurrentPlan: (plan) => set({ currentPlan: plan }),
  setIsPlaying: (value) => set({ isPlaying: value }),
  setCurrentSessionStatus: (status) => set({ currentSessionStatus: status }),
  setPlayToggle: (toggle) => set({ playToggle: toggle }),
}));
