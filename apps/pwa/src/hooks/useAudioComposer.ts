import { useCallback, useEffect, useState, useRef } from "react";
import { startAudio, stopAudio, resumeAudioContext } from "../audio/toneEngine";
import { playInsert, playEject } from "../audio/discSound";
import { takeFloor } from "../audio/playbackFloor";
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
import type { CompositionIntent } from "../ai/intentSchema";
import type { StimulusEvent } from "../types";
import type { CompositionRuntimeSnapshot } from "../audio/compositionRuntime";

export default function useAudioComposer(events: StimulusEvent[]) {
  const setStoreIsPlaying = useAppStore((state) => state.setIsPlaying);
  const setPlayToggle = useAppStore((state) => state.setPlayToggle);
  const composerSettings = useAppStore((state) => state.composerSettings);
  const setCurrentTitle = useAppStore((state) => state.setCurrentTitle);
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId);
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

  async function saveSession(events: StimulusEvent[], plan: CompositionPlan, title?: string): Promise<string | null> {
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
      return summary.id;
    } catch (error) {
      console.error("Failed to save session summary", error);
      return null;
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
      playEject();
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
      playInsert();
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

  type Composed = { plan: CompositionPlan; intent: CompositionIntent; title: string; sessionId: string | null };

  // Compose a track (generate + name + persist) WITHOUT starting playback, so
  // callers (esp. the radio) can narrate the intro before the track comes in.
  async function composeTrack(overrideEvents?: StimulusEvent[], direction?: CompositionDirection, sound?: Partial<Sound>): Promise<Composed | null> {
    if (!isModelLoaded()) {
      setStatus("Composer isn't ready yet — the model failed to load.");
      return null;
    }
    const inputEvents = overrideEvents ?? events;
    setAIStatus("Generating composition...");
    setStatus("Generating composition...");
    try {
      const settings = sound?.composerSettings ?? composerSettings;
      const { plan: composition, intent } = await generateComposition(inputEvents, settings, direction);
      // Graft in the parts of the loaded Sound the intent path can't emit —
      // the recorded melody, explicit layers, tempo — so it's truly "your sound".
      if (sound) applySoundToPlan(composition, sound);
      const title = await generateTrackNameLLM(composition, { vibe: sound?.vibe ?? direction?.vibe, moodWords: direction?.moodWords });
      const sessionId = await saveSession(inputEvents, composition, title);
      return { plan: composition, intent, title, sessionId };
    } catch (error) {
      console.error("Failed to generate composition", error);
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Composing failed: ${message}`);
      return null;
    } finally {
      setAIStatus("Ready");
    }
  }

  // Generate a plan/intent from the AI WITHOUT saving a track or playing — used
  // by the Studio's "Elevate" to fill in a sound's unset fields from the vibe.
  async function composePlanOnly(overrideEvents?: StimulusEvent[], direction?: CompositionDirection, sound?: Partial<Sound>): Promise<{ plan: CompositionPlan; intent: CompositionIntent } | null> {
    if (!isModelLoaded()) {
      setStatus("Composer isn't ready yet — the model failed to load.");
      return null;
    }
    setAIStatus("Filling in your sound...");
    setStatus("Filling in your sound...");
    try {
      const settings = sound?.composerSettings ?? composerSettings;
      const { plan, intent } = await generateComposition(overrideEvents ?? events, settings, direction);
      if (sound) applySoundToPlan(plan, sound);
      return { plan, intent };
    } catch (error) {
      console.error("Failed to fill in sound", error);
      setStatus(`Fill-in failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      setAIStatus("Ready");
    }
  }

  // Start (or restart) playback of an already-composed plan.
  const playComposed = useCallback(async (composition: CompositionPlan, intent?: CompositionIntent, title?: string | null, sessionId?: string | null) => {
    setSharedPlan(composition);
    setCurrentTitle(title ?? null);
    setCurrentSessionId(sessionId ?? null);
    setCurrentSessionSaved(true);
    try {
      playInsert(); // disc-seat "chunk" as the track comes in (also masks the start transient)
      await startAudio();
      startCompositionRuntime(composition);
      startRuntimeLoop();
      if (intent) startComposer(intent);
      setIsPlaying(true);
      setStoreIsPlaying(true);
      setStatus(`Now playing: ${composition.key}`);
    } catch (error) {
      console.error(error);
      postToast(`Audio failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      setStatus("Audio failed");
    }
  }, [setSharedPlan, setCurrentTitle, setCurrentSessionId, setStoreIsPlaying]);

  // Stop everything (used by the radio's tune-out and manual stop).
  const stopPlayback = useCallback(() => {
    playEject();
    stopAudio();
    stopRuntimeLoop();
    stopComposer();
    setIsPlaying(false);
    setStoreIsPlaying(false);
    setStatus("Audio stopped");
  }, [setStoreIsPlaying]);

  // Compose then load the plan (Today "burn" / Studio "elevate" — playback is
  // a separate user action). Returns the composed result.
  async function runAIComposer(overrideEvents?: StimulusEvent[], direction?: CompositionDirection, sound?: Partial<Sound>): Promise<Composed | null> {
    const result = await composeTrack(overrideEvents, direction, sound);
    if (!result) return null;
    setSharedPlan(result.plan);
    setCurrentTitle(result.title);
    setCurrentSessionId(result.sessionId);
    await resumeAudioContext(); // model load may have suspended the context
    startCompositionRuntime(result.plan);
    startComposer(result.intent);
    setStatus(`Composition generated: ${result.plan.key}`);
    return result;
  }

  const loadSessionPlan = useCallback(async (planInput: CompositionPlan, title?: string, sessionId?: string) => {
    takeFloor(stopPlayback); // claim the floor — stops the radio / any other playback
    setSharedPlan(planInput);
    setCurrentTitle(title ?? null);
    setCurrentSessionId(sessionId ?? null);
    setCurrentSessionSaved(true);

    try {
      playInsert();
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
  }, [setCurrentTitle, setCurrentSessionId, stopPlayback]);

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
    setCurrentTitle(null);
    setCurrentSessionId(null);
    setCurrentSessionSaved(true);
    setStatus("Tray empty");
  }, [setSharedPlan, setCurrentTitle, setCurrentSessionId, setStoreIsPlaying]);

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
    composeTrack,
    composePlanOnly,
    playComposed,
    stopPlayback,
    loadSessionPlan,
    loadStaticPlan,
    restoreSession,
    eject,
  };
}
