import { create } from "zustand";
import type { StimulusEvent } from "../types";
import type { CompositionPlan } from "../ai/types";

interface AppState {
  events: StimulusEvent[];
  setEvents: (events: StimulusEvent[]) => void;
  addEvent: (event: StimulusEvent) => void;
  currentPlan: CompositionPlan | null;
  currentIsPlaying: boolean;
  isPlaying: boolean;
  currentSessionStatus: string;
  playToggle: (() => Promise<void> | void) | null;
  setCurrentPlan: (plan: CompositionPlan | null) => void;
  setIsPlaying: (value: boolean) => void;
  setCurrentSessionStatus: (status: string) => void;
  setPlayToggle: ((toggle: (() => Promise<void> | void) | null) => void);
}

export const useAppStore = create<AppState>((set) => ({
  events: [],
  currentPlan: null,
  currentIsPlaying: false,
  isPlaying: false,
  currentSessionStatus: "Ready",
  playToggle: null,

  setEvents: (events) => set({ events }),
  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events]
    })),

  setCurrentPlan: (plan) => set({ currentPlan: plan }),
  setIsPlaying: (value) => set({ isPlaying: value }),
  setCurrentSessionStatus: (status) => set({ currentSessionStatus: status }),
  setPlayToggle: (toggle) => set({ playToggle: toggle }),
}));
