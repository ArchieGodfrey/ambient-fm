import { useCallback, useEffect, useState, useRef } from "react";
import { startAudio, stopAudio } from "../audio/toneEngine";
import { generateComposition, isModelLoaded } from "../ai/composer";
import { startGenerativeListener } from "../audio/generative";
import { unloadModel } from "../runtime/modelRuntime";
import { startCompositionRuntime, startRuntimeLoop, stopRuntimeLoop, subscribeRuntimeState } from "../audio/compositionRuntime";
import { startComposer, stopComposer } from "../composer/runtime";
import { postToast } from "../utils/toast";
import { db } from "../db/db";
import { analyzeSession } from "../memory/analyzeSession";
import { restoreRuntime } from "../runtime/restoreRuntime";
import { useAppStore } from "../store/useAppStore";
import type { CompositionPlan } from "../ai/types";
import type { StimulusEvent } from "../types";
import { getVocalSynth } from "../audio/vocal/vocalSynth";
import { getSingingParams } from "../audio/vocal/musicTheory";
import type { CompositionRuntimeSnapshot } from "../audio/compositionRuntime";

export default function useAudioComposer(events: StimulusEvent[], _modelLoaded: boolean) {
  const setStoreIsPlaying = useAppStore((state) => state.setIsPlaying);
  const setPlayToggle = useAppStore((state) => state.setPlayToggle);
  const composerSettings = useAppStore((state) => state.composerSettings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiStatus, setAIStatus] = useState("Ready");
  const [status, setStatus] = useState("Ready");
  const [plan, setPlan] = useState<CompositionPlan | null>(null);
  const setCurrentPlan = useAppStore((state) => state.setCurrentPlan);
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId);
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
    currentLyricLine: null,
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
      const sessionId = crypto.randomUUID();
      setCurrentSessionId(sessionId);
      const summary = analyzeSession(sessionId, events, plan);
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

  // When currentPlan is cleared externally (e.g. session deleted), reset local state
  const storeCurrentPlan = useAppStore((state) => state.currentPlan);
  useEffect(() => {
    if (!storeCurrentPlan) {
      if (isPlaying) {
        stopAudio();
        stopRuntimeLoop();
        stopComposer();
        setIsPlaying(false);
        setStoreIsPlaying(false);
      }
      setPlan(null); // Always clear local plan too
    }
  }, [storeCurrentPlan]);

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

  useEffect(() => {
    const cleanup = startGenerativeListener();
    return cleanup;
  }, []);

  async function presynthesize(
    lines: string[],
    voiceOverride: string | undefined,
    plan: CompositionPlan,
    onProgress?: (done: number, total: number, currentLine?: string) => void,
  ) {
    const synth = getVocalSynth();
    const voice = voiceOverride ?? 'af_sky';
    if (!voice || voice === 'browser') return;

    // Load Kokoro explicitly so the user sees "Loading Kokoro TTS..." in the
    // generate button rather than the first synthesis silently blocking
    if (!synth.isReady) {
      onProgress?.(-1, lines.length);
      try {
        await synth.load();
      } catch (loadErr) {
        postToast(`Kokoro load failed: ${loadErr instanceof Error ? loadErr.message.slice(0, 100) : String(loadErr)}`, 'error');
        return;
      }
    }

    // Send all to the worker in parallel — worker queues them internally.
    // Parallel is faster than sequential because there's no JS round-trip overhead
    // between syntheses; the worker processes them back-to-back.
    let done = 0;
    await Promise.allSettled(lines.map(async (line) => {
      const section = plan.sections.find(s => s.lyricLine === line);
      const singingParams = section ? getSingingParams(plan, section) : undefined;
      const t0 = Date.now();
      try {
        await synth.synthesize(line, voice, singingParams);
        done++;
        const secs = ((Date.now() - t0) / 1000).toFixed(1);
        postToast(`Vocal ${done}/${lines.length} ready (${secs}s)`, 'info');
        onProgress?.(done, lines.length, line);
      } catch (lineErr) {
        done++;
        postToast(`Vocal ${done}/${lines.length} failed: ${lineErr instanceof Error ? lineErr.message.slice(0, 80) : String(lineErr)}`, 'error');
        onProgress?.(done, lines.length);
      }
    }));
  }

  async function runAIComposer(overrideEvents?: StimulusEvent[]) {
    if (!isModelLoaded()) {
      postToast("Model not loaded. Load the model before generating.", "warning");
      setStatus("Model not loaded. Load the model before generating.");
      return;
    }

    const inputEvents = overrideEvents ?? events;
    setAIStatus("Generating composition...");
    setStatus("Generating composition...");

    try {
      const { plan: composition, intent } = await generateComposition(inputEvents, composerSettings);
      // Resolve the actual Kokoro voice BEFORE saving so the session stores the
      // correct voice and warmCache can reconstruct cache keys on reload.
      // 'ai' means the AI was asked to choose (it may have set composition.vocalVoice),
      // but 'ai' itself is never a valid synthesis voice — resolve it to a specific one.
      const settingsVoice = composerSettings.vocalVoice;
      let resolvedVoice = composition.vocalVoice; // AI may have chosen one
      if (!resolvedVoice || resolvedVoice === 'ai') {
        // AI didn't pick or user wants default — use settings or fall back to af_sky
        resolvedVoice = settingsVoice !== 'ai' && settingsVoice !== 'browser'
          ? settingsVoice
          : 'af_sky';
      }
      // Store resolved voice on plan before saving so it's retrievable on reload
      if (resolvedVoice && resolvedVoice !== 'browser') {
        composition.vocalVoice = resolvedVoice;
      }
      postToast(`Voice: ${resolvedVoice} · Key: ${composition.key}`, 'info');

      setSharedPlan(composition);
      await saveSession(inputEvents, composition);

      // Unload LLM BEFORE loading Kokoro TTS — both can't be in memory simultaneously on mobile
      setStatus('Unloading language model…');
      try { await unloadModel(); } catch { /* non-critical */ }

      // Kick off Kokoro loading now (fire-and-forget) so it's initialising in parallel
      // with runtime setup. presynthesize() will await it properly before synthesis.
      if (!getVocalSynth().isReady) getVocalSynth().load().catch(() => {});

      // Start the runtime immediately — music is available to play right away.
      // Web Speech handles any vocals that aren't cached yet; Kokoro takes over
      // as synthesis completes. The composition loops, so second listen = all Kokoro.
      try {
        startCompositionRuntime(composition);
      } catch (runtimeErr) {
        postToast(`Runtime start failed: ${runtimeErr instanceof Error ? runtimeErr.message : String(runtimeErr)}`, 'error');
      }
      startComposer(intent);
      setStatus(`Ready · ${composition.key} · ${composition.bpm} BPM — press play`);

      // Synthesise vocals in the background while the user can already hear the music.
      // Results are cached in IndexedDB; second loop plays all Kokoro.
      const lyricLines = composition.sections.map((s) => s.lyricLine).filter((l): l is string => Boolean(l));
      if (lyricLines.length > 0 && resolvedVoice && resolvedVoice !== 'browser') {
        try {
          await presynthesize(lyricLines, resolvedVoice, composition, (done, total, currentLine) => {
            if (done === -1) {
              setStatus('Loading Kokoro TTS…');
            } else if (done < total) {
              const preview = currentLine ? `: "${currentLine.slice(0, 35)}${currentLine.length > 35 ? '…' : ''}"` : '';
              setStatus(`Preparing vocal ${done + 1}/${total}${preview}`);
            } else {
              setStatus('Vocals ready — Kokoro active');
            }
          });
        } catch (synthErr) {
          postToast(`Vocal synthesis failed: ${synthErr instanceof Error ? synthErr.message : String(synthErr)}`, 'error');
        }
      } else if (lyricLines.length === 0) {
        postToast('No lyric lines found — AI may not have generated them', 'warning');
      }
    } catch (error) {
      console.error("Failed to generate composition", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`AI composition failed: ${message}`, "error");
      setStatus(`AI composition failed: ${message}`);
    } finally {
      setAIStatus("Ready");
    }
  }

  const loadSessionPlan = useCallback(async (planInput: CompositionPlan, sessionId?: string) => {
    setSharedPlan(planInput);
    if (sessionId) setCurrentSessionId(sessionId);
    setCurrentSessionSaved(true);

    try {
      await startAudio();
      setIsPlaying(true);
      setStoreIsPlaying(true);
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
    // Warm vocal audio cache from DB so vocals play without re-synthesising
    getVocalSynth().warmCache(planInput, planInput.vocalVoice ?? 'af_sky').catch(() => {});
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
