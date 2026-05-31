import { create } from "zustand";
import type { StimulusEvent } from "../types";

interface AppState {
  events: StimulusEvent[];
  setEvents: (events: StimulusEvent[]) => void;
  addEvent: (event: StimulusEvent) => void;
}

export const useAppStore = create<AppState>((set) => ({
  events: [],

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events]
    }))
}));
