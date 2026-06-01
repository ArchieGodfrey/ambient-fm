import { initializeComposer } from "./index";
import type { CompositionIntent } from "../ai/intentSchema";

export function startComposer(intent: CompositionIntent) {
  stopComposer();
  initializeComposer({ intent, emotion: null });
}

export function stopComposer() {
  // Composer no longer relies on a timed update loop.
}
