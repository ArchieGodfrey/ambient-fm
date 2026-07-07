import { useCallback, useEffect, useState, useRef } from "react";
import { startAudio, stopAudio, resumeAudioContext } from "../audio/toneEngine";
import { generateComposition, isModelLoaded } from "../ai/composer";
import type { CompositionDirection } from "../ai/prompt";
import { startCompositionRuntime, startRuntimeLoop, stopRuntimeLoop, subscribeRuntimeState } from "../audio/compositionRuntime";
import { startComposer, stopComposer } from "../composer/runtime";
import { postToast } from "../utils/toast";
import { db } from "../db/db";
import { analyzeSession } from "../memory/analyzeSession";
import { generateTrackName, generateTrackNameLLM } from "../ai/trackName";
import { applySoundToPlan } from "../sounds/soundDirection";
import type { Sound } from "../sounds/types";
import { restoreRuntime } from "../runtime/restoreRuntime";
import { useAppStore } from "../store/useAppStore";
import type { CompositionPlan } from "../ai/types";
import type { StimulusEvent } from "../types";
import type { CompositionRuntimeSnapshot } from "../audio/compositionRuntime";

export default function useAudioComposer(events: StimulusEvent[]) {
  const setStoreIsPlaying = useAppStore((state) => state.setIsPlaying);
  const setPlayToggle = useAppStore((state) => state.setPlayToggle);
  const composerSettings = useAppStore((state) => state.composerSettings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiStatus, setAIStatus] = useState("Ready");
  const [status, setStatus] = useState("Ready");
  const [plan, setPlan] = useState<CompositionPlan | null>(null);
  const setCurrentPlan = useAppStore((state) => state.setCurrentPlan);
  const [currentSessionSaved, setCurrentSessionSaved] = useState(false);
  const [runtimeState, setRuntimeState] = useState<CompositionRuntimeSnapshot>({
    cursor: 0,
    activeSection: null,
    activePhrase: null,
    intensity: 0,
    drift: 0,
    planDuration: 0,
    sectionTimeRemaining: 0,
    activeMotifs: 0,
    runtimeUptime: 0,
    frameDelay: 0,
    audioRestartCount: 0,
    snapshotCount: 0,
  });

  const setSharedPlan = useCallback((planInput: CompositionPlan | null) => {
    setPlan(planInput);
    setCurrentPlan(planInput);
  }, [setCurrentPlan]);
  const playToggleRef = useRef<(() => Promise<void> | void) | null>(null);

  async function pruneOldSessions() {
    try {
      const oldSessions = await db.sessions.orderBy("timestamp").reverse().offset(50).toArray();
      await Promise.all(oldSessions.map((session) => db.sessions.delete(session.id)));
    } catch (error) {
      console.error("Failed to prune old sessions", error);
    }
  }

  async function saveSession(events: StimulusEvent[], plan: CompositionPlan, title?: string) {
    try {
      const summary = analyzeSession(crypto.randomUUID(), events, plan);
      summary.plan = plan;
      summary.title = title ?? generateTrackName(plan);
      await db.sessions.add(summary);
      await pruneOldSessions();
      setCurrentSessionSaved(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("session-saved"));
      }
    } catch (error) {
      console.error("Failed to save session summary", error);
    }
  }

  const endSession = useCallback(async (events: StimulusEvent[], plan: CompositionPlan | null) => {
    if (!plan || currentSessionSaved) {
      return;
    }

    await saveSession(events, plan);
  }, [currentSessionSaved]);

  const handlePlayToggle = useCallback(async () => {
    if (isPlaying) {
      stopAudio();
      stopRuntimeLoop();
      stopComposer();
      await endSession(events, plan);
      setIsPlaying(false);
      setStoreIsPlaying(false);
      setStatus("Audio stopped");
      return;
    }

    try {
      await startAudio();
      if (plan) {
        startCompositionRuntime(plan);
        startRuntimeLoop();
      }
      setIsPlaying(true);
      setStoreIsPlaying(true);
      setStatus("Audio started");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Audio failed: ${message}`, "error");
      setStatus("Audio failed");
    }
  }, [endSession, events, isPlaying, plan, setStoreIsPlaying]);

  useEffect(() => {
    if (playToggleRef.current !== handlePlayToggle) {
      setPlayToggle(handlePlayToggle);
      playToggleRef.current = handlePlayToggle;
    }
  }, [handlePlayToggle, setPlayToggle]);

  useEffect(() => {
    const unsubscribe = subscribeRuntimeState(setRuntimeState);
    return unsubscribe;
  }, []);

  async function runAIComposer(overrideEvents?: StimulusEvent[], direction?: CompositionDirection, sound?: Partial<Sound>) {
    if (!isModelLoaded()) {
      setStatus("Composer isn't ready yet — the model failed to load.");
      return;
    }

    const inputEvents = overrideEvents ?? events;
    setAIStatus("Generating composition...");
    setStatus("Generating composition...");

    try {
      const settings = sound?.composerSettings ?? composerSettings;
      const { plan: composition, intent } = await generateComposition(inputEvents, settings, direction);
      // Graft in the parts of the loaded Sound the intent path can't emit —
      // the recorded melody, explicit layers, tempo — so the burn is truly "your sound".
      if (sound) applySoundToPlan(composition, sound);
      setSharedPlan(composition);
      await resumeAudioContext(); // model load may have suspended the context
      startCompositionRuntime(composition);
      startComposer(intent);
      setStatus(`Composition generated: ${composition.key}`);
      // Name it with the model (fallbacks to deterministic), then persist —
      // done after audio starts so naming latency doesn't delay playback.
      const title = await generateTrackNameLLM(composition, { vibe: sound?.vibe ?? direction?.vibe, moodWords: direction?.moodWords });
      await saveSession(inputEvents, composition, title);
    } catch (error) {
      // No fallback — surface the failure instead of presenting a stand-in disc.
      console.error("Failed to generate composition", error);
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Composing failed: ${message}`);
    } finally {
      setAIStatus("Ready");
    }
  }

  const loadSessionPlan = useCallback(async (planInput: CompositionPlan) => {
    setSharedPlan(planInput);
    setCurrentSessionSaved(true);

    try {
      await startAudio();
      setIsPlaying(true);
      setStoreIsPlaying(true); // keep the transport bar's Play/Stop in sync
      setStatus("Session loaded and playing");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Audio failed: ${message}`, "error");
      setStatus("Audio failed");
      return;
    }

    startCompositionRuntime(planInput);
    startRuntimeLoop();
  }, []);

  const loadStaticPlan = useCallback((planInput: CompositionPlan) => {
    setSharedPlan(planInput);
    setCurrentSessionSaved(true);
    setStatus("Loaded most recent session plan");
  }, [setSharedPlan]);

  // Eject the loaded disc: stop everything and clear the tray. Used when the
  // last remaining track is deleted so nothing stale keeps playing.
  const eject = useCallback(() => {
    stopAudio();
    stopRuntimeLoop();
    stopComposer();
    setIsPlaying(false);
    setStoreIsPlaying(false);
    setSharedPlan(null);
    setCurrentSessionSaved(true);
    setStatus("Tray empty");
  }, [setSharedPlan, setStoreIsPlaying]);

  const restoreSession = useCallback(async () => {
    try {
      const snapshot = await restoreRuntime({ startAudio: false });
      if (!snapshot) {
        return null;
      }

      setSharedPlan(snapshot.plan);
      setStatus("Session restored");
      setCurrentSessionSaved(true);
      return snapshot;
    } catch (error) {
      console.error("Failed to restore session", error);
      return null;
    }
  }, []);

  return {
    isPlaying,
    aiStatus,
    status,
    plan,
    runtimeState,
    handlePlayToggle,
    runAIComposer,
    loadSessionPlan,
    loadStaticPlan,
    restoreSession,
    eject,
  };
}
