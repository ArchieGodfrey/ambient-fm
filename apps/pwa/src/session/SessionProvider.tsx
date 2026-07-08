import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { db } from "../db/db";
import { setMediaSessionHandlers, setMediaSessionTrack, setMediaSessionPlaying, clearMediaSession } from "../audio/backgroundAudio";
import { buildStimulusSnapshot } from "../stimuli/buildStimulusSnapshot";
import { useAppStore } from "../store/useAppStore";
import useModelManager from "../hooks/useModelManager";
import useAudioComposer from "../hooks/useAudioComposer";
import useRadio from "../hooks/useRadio";
import useSessionHistory from "../hooks/useSessionHistory";
import { getAvailableModels, getSelectedModelId, selectModel, isModelLoaded } from "../ai/composer";
import { resumeAudioContext } from "../audio/toneEngine";
import type { CompositionDirection } from "../ai/prompt";
import type { Sound } from "../sounds/types";
import { generateVibeText } from "../ai/vibe";
import OffscreenCanvasHost from "../components/OffscreenCanvasHost";

type WorkerInitPayload = { canvas: OffscreenCanvas; width: number; height: number };

function isToday(ts: number) {
  const d = new Date(ts), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

// Single owner of the WebLLM/WebGPU + audio runtime, shared with every screen.
// Instantiating the composer/model hooks more than once would spawn duplicate
// workers and fight over the shared play toggle, so this lives at the app root.
function useSessionRuntime() {
  const { events, setEvents, addEvent, currentPlan, setCurrentSessionStatus, currentTitle, currentSessionId, isPlaying, playToggle } = useAppStore();
  const [workerInitPayload, setWorkerInitPayload] = useState<WorkerInitPayload | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [appStatus, setAppStatus] = useState("Ready");
  const [selectedModelId, setSelectedModelId] = useState(getSelectedModelId());
  const availableModels = getAvailableModels();

  const model = useModelManager(workerInitPayload);
  const audio = useAudioComposer(events);
  const radio = useRadio(audio, events, model);
  const { sessions } = useSessionHistory();

  async function refreshStimuli() {
    try {
      const snapshot = await buildStimulusSnapshot();
      for (const event of snapshot) {
        await db.events.add(event);
        addEvent(event);
      }
    } catch (error) {
      console.error("Refresh failed", error);
    }
  }

  async function loadEvents() {
    try {
      const loaded = await db.events.orderBy("timestamp").reverse().toArray();
      const normalized = loaded.map((event) => {
        const strength = typeof event.strength === "number"
          ? event.strength
          : typeof (event as any).value === "number"
            ? Math.max(0, Math.min(1, (event as any).value))
            : 0.5;
        return { ...event, strength };
      });
      setEvents(normalized);
      if (!normalized.some((event) => event.source === "time")) {
        await refreshStimuli();
      }
    } catch (error) {
      console.error("Failed to load events", error);
      setAppStatus("Load failed");
    }
  }

  async function handleGenerate(direction?: CompositionDirection, sound?: Partial<Sound>) {
    setIsGenerating(true);
    // Burning is a user gesture — resume the audio context now so the composition
    // nodes prepared below don't hit the browser autoplay warning.
    await resumeAudioContext();
    try {
      // loadModel downloads-if-needed AND loads in a single runtime init, so we
      // avoid the download→teardown→load race that left the model unloaded.
      // Gate on the real runtime state, not the (possibly stale) React flag.
      if (!isModelLoaded()) {
        const loaded = await model.loadModelAction();
        if (!loaded) {
          setAppStatus("Composer failed to prepare.");
          return null;
        }
      }
      return await audio.runAIComposer(undefined, direction, sound);
    } finally {
      // Keep the model loaded between burns — reloading each time was slow and
      // race-prone. The user can unload manually in Settings if needed.
      setIsGenerating(false);
    }
  }

  // Elevate: use the AI to fill in a sound (from its vibe + settings) without
  // making a track. Returns the proposed plan/intent for the caller to map back.
  async function elevateSound(direction?: CompositionDirection, sound?: Partial<Sound>) {
    setIsGenerating(true);
    try {
      if (!isModelLoaded()) {
        const loaded = await model.loadModelAction();
        if (!loaded) { setAppStatus("Composer failed to prepare."); return null; }
      }
      return await audio.composePlanOnly(undefined, direction, sound);
    } finally {
      setIsGenerating(false);
    }
  }

  // Tune in: resume audio within the gesture, ensure the model is ready, then
  // hand off to the radio loop. Mirrors handleGenerate's model gating.
  async function startRadio() {
    await resumeAudioContext();
    if (!isModelLoaded()) {
      const loaded = await model.loadModelAction();
      if (!loaded) {
        setAppStatus("Composer failed to prepare.");
        return;
      }
    }
    radio.tuneIn();
  }

  async function generateVibe(opts: { moodWords: string; key?: string; tempo?: number; instruction?: string }): Promise<string> {
    if (!isModelLoaded()) {
      const loaded = await model.loadModelAction();
      if (!loaded) throw new Error("Composer failed to load");
    }
    return generateVibeText(opts);
  }

  async function selectModelAction(modelId: string) {
    if (modelId === selectedModelId) return;
    await model.resetRuntimeAction();
    selectModel(modelId);
    setSelectedModelId(modelId);
    await model.checkModelState();
  }

  // One-time init: load stored stimuli, then restore or seed a plan.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      await loadEvents();
      if (cancelled) return;
      if (!currentPlan) {
        const restored = await audio.restoreSession();
        if (!restored && sessions.length > 0 && sessions[0].plan) {
          audio.loadStaticPlan(sessions[0].plan);
        }
      } else {
        audio.loadStaticPlan(currentPlan);
      }
    }
    void init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eject the loaded disc when the last track is deleted (sessions 0 → empty),
  // so a stale plan doesn't keep playing/showing after the library is cleared.
  const prevSessionCount = useRef(sessions.length);
  useEffect(() => {
    if (prevSessionCount.current > 0 && sessions.length === 0) audio.eject();
    prevSessionCount.current = sessions.length;
  }, [sessions.length, audio]);

  // Surface the most relevant status in the transport bar.
  const displayStatus = model.progressText ?? model.status ?? audio.status ?? appStatus;
  useEffect(() => {
    if (displayStatus) setCurrentSessionStatus(displayStatus);
  }, [displayStatus, setCurrentSessionStatus]);

  // Manual playback: step through today's tracks (lock-screen next/prev + could
  // be reused elsewhere).
  const manualStep = useCallback((dir: number) => {
    const today = sessions.filter((s) => isToday(s.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
    const i = today.findIndex((t) => t.id === currentSessionId);
    const t = i >= 0 ? today[i + dir] : undefined;
    if (t?.plan) void audio.loadSessionPlan(t.plan, t.title, t.id);
  }, [sessions, currentSessionId, audio]);

  // One place that reflects the current playback (radio OR manual) into the
  // lock-screen controls — so it's consistent however audio was started.
  useEffect(() => {
    const active = radio.isOn || isPlaying;
    if (!active) { clearMediaSession(); return; }
    setMediaSessionPlaying(true);
    const title = radio.isOn ? radio.nowPlaying?.title : currentTitle;
    if (title) setMediaSessionTrack(title);
    if (radio.isOn) {
      setMediaSessionHandlers({ onPlay: radio.tuneIn, onPause: radio.tuneOut, onNext: radio.skip, onPrev: radio.previous });
    } else {
      setMediaSessionHandlers({ onPlay: () => playToggle?.(), onPause: () => playToggle?.(), onNext: () => manualStep(1), onPrev: () => manualStep(-1) });
    }
  }, [radio.isOn, radio.nowPlaying?.title, radio.tuneIn, radio.tuneOut, radio.skip, radio.previous, isPlaying, currentTitle, playToggle, manualStep]);

  return {
    events,
    model,
    audio,
    isGenerating,
    handleGenerate,
    elevateSound,
    radio,
    startRadio,
    generateVibe,
    refreshStimuli,
    availableModels,
    selectedModelId,
    selectModelAction,
    displayStatus,
    setWorkerInitPayload,
  };
}

type SessionContextValue = ReturnType<typeof useSessionRuntime>;
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useSessionRuntime();
  const ctx = useMemo(() => value, [value]);
  return (
    <SessionContext.Provider value={ctx}>
      <OffscreenCanvasHost onPayloadChange={value.setWorkerInitPayload} />
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
