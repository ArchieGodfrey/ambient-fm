import { useCallback, useEffect, useState, useRef } from "react";
import { startAudio, stopAudio } from "../audio/toneEngine";
import { generateComposition, fallbackComposition } from "../ai/composer";
import { startCompositionRuntime, startRuntimeLoop, stopRuntimeLoop, subscribeRuntimeState } from "../audio/compositionRuntime";
import { postToast } from "../utils/toast";
import { db } from "../db/db";
import { analyzeSession } from "../memory/analyzeSession";
import { restoreRuntime } from "../runtime/restoreRuntime";
import { useAppStore } from "../store/useAppStore";
import type { CompositionPlan } from "../ai/types";
import type { StimulusEvent } from "../types";
import type { CompositionRuntimeSnapshot } from "../audio/compositionRuntime";

export default function useAudioComposer(events: StimulusEvent[], modelLoaded: boolean) {
  const setStoreIsPlaying = useAppStore((state) => state.setIsPlaying);
  const setPlayToggle = useAppStore((state) => state.setPlayToggle);
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

  async function saveSession(events: StimulusEvent[], plan: CompositionPlan) {
    try {
      const summary = analyzeSession(crypto.randomUUID(), events, plan);
      summary.plan = plan;
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
      await endSession(events, plan);
      setIsPlaying(false);
      setStoreIsPlaying(false);
      setStatus("Audio stopped");
      return;
    }

    try {
      await startAudio();
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

  async function runAIComposer(overrideEvents?: StimulusEvent[]) {
    if (!modelLoaded) {
      postToast("Model not loaded. Load the model before generating.", "warning");
      setStatus("Model not loaded. Load the model before generating.");
      return;
    }

    const inputEvents = overrideEvents ?? events;
    setAIStatus("Generating composition...");
    setStatus("Generating composition...");

    try {
      const composition = await generateComposition(inputEvents);
      setSharedPlan(composition);
      await saveSession(inputEvents, composition);
      startCompositionRuntime(composition);
      startRuntimeLoop();
      setStatus(`Composition generated: ${composition.key}`);
    } catch (error) {
      console.error("Failed to generate composition", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`AI composition failed: ${message}`, "error");
      setStatus(`AI composition failed: ${message}`);
      const fallback = fallbackComposition();
      setSharedPlan(fallback);
      startCompositionRuntime(fallback);
      startRuntimeLoop();
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
  };
}
