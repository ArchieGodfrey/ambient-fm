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
  vocalsEnabled: boolean;
  setVocalsEnabled: (val: boolean) => void;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  hfToken: string;
  setHfToken: (token: string) => void;
  melodyEnabled: boolean;
  setMelodyEnabled: (v: boolean) => void;
  generativeMode: boolean;
  setGenerativeMode: (v: boolean) => void;
}

const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = {
  complexity: 0.4,
  motifDensity: 0.4,
  harmonicMovement: 0.4,
  allowedInstruments: ['drone', 'pad', 'texture', 'pulse'],
  minSections: 3,
  maxSections: 5,
  vocalVoice: 'ai',
  keyMode: 'any',
  maxBpm: 120,
  melodyInstrument: 'ai',
  bassType: 'ai',
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
  vocalsEnabled: true,
  setVocalsEnabled: (val) => set({ vocalsEnabled: val }),
  currentSessionId: null,
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  hfToken: '',
  setHfToken: (token) => set({ hfToken: token }),
  melodyEnabled: true,
  setMelodyEnabled: (v) => set({ melodyEnabled: v }),
  generativeMode: false,
  setGenerativeMode: (v) => set({ generativeMode: v }),
}));
