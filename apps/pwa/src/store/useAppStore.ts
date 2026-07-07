import { create } from "zustand";
import type { StimulusEvent } from "../types";
import type { CompositionPlan } from "../ai/types";
import type { ComposerSettings } from "../features/composer/types";

interface AppState {
  events: StimulusEvent[];
  setEvents: (events: StimulusEvent[]) => void;
  addEvent: (event: StimulusEvent) => void;
  currentPlan: CompositionPlan | null;
  currentTitle: string | null;
  currentIsPlaying: boolean;
  isPlaying: boolean;
  currentSessionStatus: string;
  playToggle: (() => Promise<void> | void) | null;
  composerSettings: ComposerSettings;
  setComposerSettings: (settings: ComposerSettings) => void;
  setCurrentPlan: (plan: CompositionPlan | null) => void;
  setCurrentTitle: (title: string | null) => void;
  setIsPlaying: (value: boolean) => void;
  setCurrentSessionStatus: (status: string) => void;
  setPlayToggle: ((toggle: (() => Promise<void> | void) | null) => void);
  debug: boolean;
  setDebug: (value: boolean) => void;
  logs: DebugLogEntry[];
  pushLog: (entry: DebugLogEntry) => void;
  clearLogs: () => void;
}

export interface DebugLogEntry {
  level: "warn" | "error";
  message: string;
  ts: number;
}

// Persist the debug log to localStorage so it survives a reload — critical for
// diagnosing crashes (e.g. iOS tab crashes) where the in-memory log is lost.
const LOG_KEY = "ambientfm-debuglog";
function loadLogs(): DebugLogEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); } catch { return []; }
}
function saveLogs(logs: DebugLogEntry[]) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-80))); } catch { /* quota/full */ }
}

const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = {
  complexity: 0.4,
  motifDensity: 0.4,
  harmonicMovement: 0.4,
};

export const useAppStore = create<AppState>((set) => ({
  events: [],
  currentPlan: null,
  currentTitle: null,
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
  setCurrentTitle: (title) => set({ currentTitle: title }),
  setIsPlaying: (value) => set({ isPlaying: value }),
  setCurrentSessionStatus: (status) => set({ currentSessionStatus: status }),
  setPlayToggle: (toggle) => set({ playToggle: toggle }),
  debug: false,
  setDebug: (value) => set({ debug: value }),
  logs: loadLogs(),
  pushLog: (entry) => set((state) => {
    const logs = [...state.logs.slice(-79), entry];
    saveLogs(logs);
    return { logs };
  }),
  clearLogs: () => { saveLogs([]); set({ logs: [] }); },
}));
