import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "../db/db";
import { buildStimulusSnapshot } from "../stimuli/buildStimulusSnapshot";
import { useAppStore } from "../store/useAppStore";
import useModelManager from "../hooks/useModelManager";
import useAudioComposer from "../hooks/useAudioComposer";
import useSessionHistory from "../hooks/useSessionHistory";
import { getAvailableModels, getSelectedModelId, selectModel, isModelLoaded } from "../ai/composer";
import { postToast } from "../utils/toast";
import { resumeAudioContext } from "../audio/toneEngine";
import OffscreenCanvasHost from "../components/OffscreenCanvasHost";

type WorkerInitPayload = { canvas: OffscreenCanvas; width: number; height: number };

// Single owner of the WebLLM/WebGPU + audio runtime, shared with every screen.
// Instantiating the composer/model hooks more than once would spawn duplicate
// workers and fight over the shared play toggle, so this lives at the app root.
function useSessionRuntime() {
  const { events, setEvents, addEvent, currentPlan, setCurrentSessionStatus } = useAppStore();
  const [workerInitPayload, setWorkerInitPayload] = useState<WorkerInitPayload | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [appStatus, setAppStatus] = useState("Ready");
  const [selectedModelId, setSelectedModelId] = useState(getSelectedModelId());
  const availableModels = getAvailableModels();

  const model = useModelManager(workerInitPayload);
  const audio = useAudioComposer(events, model.modelLoaded);
  const { sessions } = useSessionHistory();

  async function refreshStimuli() {
    try {
      const snapshot = await buildStimulusSnapshot();
      for (const event of snapshot) {
        await db.events.add(event);
        addEvent(event);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Refresh failed: ${message}`, "error");
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
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Failed to load events: ${message}`, "error");
      setAppStatus("Load failed");
    }
  }

  async function handleGenerate() {
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
          return;
        }
      }
      await audio.runAIComposer();
    } finally {
      await model.unloadModelAction();
      setIsGenerating(false);
    }
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

  // Surface the most relevant status in the transport bar.
  const displayStatus = model.progressText ?? model.status ?? audio.status ?? appStatus;
  useEffect(() => {
    if (displayStatus) setCurrentSessionStatus(displayStatus);
  }, [displayStatus, setCurrentSessionStatus]);

  return {
    events,
    model,
    audio,
    isGenerating,
    handleGenerate,
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
