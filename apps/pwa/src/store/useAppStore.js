import { create } from "zustand";
export const useAppStore = create((set) => ({
    events: [],
    setEvents: (events) => set({ events }),
    addEvent: (event) => set((state) => ({
        events: [event, ...state.events]
    }))
}));
