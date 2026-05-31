import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { buildStimulusSnapshot } from "../stimuli/buildStimulusSnapshot";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import Toasts from "../components/Toasts";
import StatusBar from "../components/StatusBar";
import TimelinePage from "./TimelinePage";
import MainActions from "../components/MainActions";
import ModelActions from "../components/ModelActions";
import MoodButtons from "../components/MoodButtons";
import CompositionPlanSummary from "../components/CompositionPlanSummary";
import OffscreenCanvasHost from "../components/OffscreenCanvasHost";
import RuntimeDiagnostics from "../components/RuntimeDiagnostics";
import useToastEvents from "../hooks/useToastEvents";
import useModelManager from "../hooks/useModelManager";
import useAudioComposer from "../hooks/useAudioComposer";
import { getAvailableModels, getSelectedModelId, selectModel } from "../ai/composer";
import { subscribeRuntimeState, type CompositionRuntimeSnapshot } from "../audio/compositionRuntime";
import { postToast } from "../utils/toast";
import type { StimulusEvent } from "../types";

export default function HomePage() {
  const { events, setEvents, addEvent } = useAppStore();
  const [workerInitPayload, setWorkerInitPayload] = useState<{ canvas: OffscreenCanvas; width: number; height: number } | undefined>(undefined);
  const [selectedModelId, setSelectedModelId] = useState(getSelectedModelId());
  const availableModels = getAvailableModels();
  const toasts = useToastEvents();
  const [appStatus, setAppStatus] = useState("Ready");
  const {
    status: modelStatus,
    modelDownloaded,
    modelLoaded,
    modelProgress,
    progressText,
    gpuStatus,
    gpuLimits,
    heapUsage,
    downloadModelAction,
    loadModelAction,
    unloadModelAction,
    deleteModelAction,
    resetRuntimeAction,
    checkModelState,
  } = useModelManager(workerInitPayload);
  const {
    isPlaying,
    aiStatus,
    status: audioStatus,
    plan,
    handlePlayToggle,
    runAIComposer,
  } = useAudioComposer(events, modelLoaded);
  const [runtimeState, setRuntimeState] = useState<CompositionRuntimeSnapshot>({
    cursor: 0,
    activeSection: null,
    intensity: 0,
    drift: 0,
    planDuration: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const displayStatus = progressText ?? modelStatus ?? audioStatus ?? appStatus;

  async function loadEvents() {
    try {
      const loaded = await db.events.orderBy("timestamp").reverse().toArray();
      setEvents(loaded);
      if (!loaded.some((event) => event.source === "time")) {
        await refreshStimuli();
      }
    } catch (error) {
      console.error("Failed to load events", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Failed to load events: ${message}`, "error");
      setAppStatus("Load failed");
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeRuntimeState(setRuntimeState);
    return unsubscribe;
  }, []);

  // Audio and AI composition are managed by useAudioComposer.

  async function addMood(label: string) {
    const event: StimulusEvent = {
      id: nanoid(),
      timestamp: Date.now(),
      source: "manual",
      label,
    };

    try {
      await db.events.add(event);
      addEvent(event);
      setAppStatus(`Added ${label}`);
    } catch (error) {
      console.error("Failed to save mood event", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Save failed: ${message}`, "error");
      setAppStatus("Save failed");
    }
  }

  async function refreshStimuli() {
    setRefreshing(true);
    try {
      const snapshot = await buildStimulusSnapshot();
      for (const event of snapshot) {
        await db.events.add(event);
        addEvent(event);
      }
      setAppStatus("Environment refreshed");
    } catch (error) {
      console.error("Failed to refresh stimuli", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Refresh failed: ${message}`, "error");
      setAppStatus("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const lastWeather = events.find((event) => event.source === "weather");
  const lastTime = events.find((event) => event.source === "time");

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <OffscreenCanvasHost onPayloadChange={setWorkerInitPayload} />
      <Toasts toasts={toasts} />
      <h1>Ambient FM</h1>
      <p style={{ margin: "0 0 16px" }}>
        Tap play once, then log mood or refresh the environment.
      </p>

      <MainActions
        isPlaying={isPlaying}
        refreshing={refreshing}
        aiReady={aiStatus === "Ready" && modelLoaded}
        onPlayToggle={handlePlayToggle}
        onRefresh={refreshStimuli}
        onGenerate={runAIComposer}
        onToggleMonitor={() => window.dispatchEvent(new CustomEvent('toggle-monitor'))}
      />

      <ModelActions
        availableModels={availableModels}
        selectedModelId={selectedModelId}
        onSelectModel={async (modelId) => {
          if (modelId === selectedModelId) return;
          const label = availableModels.find((model) => model.model_id === modelId)?.label ?? modelId;
          setAppStatus(`Switching to ${label}...`);
          await resetRuntimeAction();
          selectModel(modelId);
          setSelectedModelId(modelId);
          await checkModelState();
          setAppStatus(`Selected ${label}`);
        }}
        modelLoaded={modelLoaded}
        modelDownloaded={modelDownloaded}
        onDownload={downloadModelAction}
        onLoad={loadModelAction}
        onUnload={unloadModelAction}
        onDelete={deleteModelAction}
        onResetRuntime={resetRuntimeAction}
      />

      <StatusBar
        status={displayStatus}
        aiStatus={aiStatus}
        modelLoaded={modelLoaded}
        modelDownloaded={modelDownloaded}
        modelProgress={modelProgress}
      />

      <RuntimeDiagnostics
        gpuStatus={gpuStatus}
        gpuLimits={gpuLimits}
        heapUsage={heapUsage}
        runtimeCursor={runtimeState.cursor}
        activeSection={runtimeState.activeSection}
        runtimeIntensity={runtimeState.intensity}
        runtimeDrift={runtimeState.drift}
      />

      <MoodButtons onAddMood={addMood} />

      <CompositionPlanSummary
        events={events}
        lastTime={lastTime}
        lastWeather={lastWeather}
        plan={plan}
        runtimeCursor={runtimeState.cursor}
        activeSection={runtimeState.activeSection}
      />

      <TimelinePage />
    </div>
  );
}
