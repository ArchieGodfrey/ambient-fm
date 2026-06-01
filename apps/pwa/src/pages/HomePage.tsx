import "./HomePage.css";
import { useEffect, useMemo, useState } from "react";
import { buildStimulusSnapshot } from "../stimuli/buildStimulusSnapshot";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import Toasts from "../components/Toasts";
import MainActions from "../components/MainActions";
import ModelActions from "../components/ModelActions";
import CompositionPlanSummary from "../components/CompositionPlanSummary";
import OffscreenCanvasHost from "../components/OffscreenCanvasHost";
import RuntimeDiagnostics from "../components/RuntimeDiagnostics";
import useToastEvents from "../hooks/useToastEvents";
import useModelManager from "../hooks/useModelManager";
import useAudioComposer from "../hooks/useAudioComposer";
import useSessionHistory from "../hooks/useSessionHistory";
import { getAvailableModels, getSelectedModelId, selectModel } from "../ai/composer";
import { postToast } from "../utils/toast";

export default function HomePage() {
  const { events, setEvents, addEvent, currentPlan, setCurrentSessionStatus } = useAppStore();
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
    downloadModelAction,
    loadModelAction,
    unloadModelAction,
    resetRuntimeAction,
    deleteModelAction,
    checkModelState,
  } = useModelManager(workerInitPayload);
  const [isGenerating, setIsGenerating] = useState(false);
  const {
    status: audioStatus,
    plan,
    runtimeState,
    runAIComposer,
    loadSessionPlan,
    loadStaticPlan,
    restoreSession,
  } = useAudioComposer(events, modelLoaded);
  const { sessions } = useSessionHistory();
  const compositionPreview = useMemo(() => {
    const sourceCounts = events.reduce(
      (counts, event) => {
        const source = typeof event.source === "string" ? event.source : String(event.source);
        counts[source] = (counts[source] ?? 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );

    const manualEvents = events.filter((event) => event.source === "manual");
    const manualStrength = manualEvents.length
      ? manualEvents.reduce((sum, event) => sum + event.strength, 0) / manualEvents.length
      : 0;

    const sourceLabels = Object.entries(sourceCounts)
      .map(([source, count]) => `${source} ${count}`)
      .join(" · ");

    return {
      totalEvents: events.length,
      sourceCounts,
      sourceLabels: sourceLabels || "None",
      manualCount: manualEvents.length,
      manualStrength,
    };
  }, [events]);

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
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Failed to load events: ${message}`, "error");
      setAppStatus("Load failed");
    }
  }

  async function refreshStimuli() {
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
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      if (!modelDownloaded) {
        const downloaded = await downloadModelAction();
        if (!downloaded) {
          return;
        }
      }

      if (!modelLoaded) {
        const loaded = await loadModelAction();
        if (!loaded) {
          return;
        }
      }

      await runAIComposer();
    } finally {
      await unloadModelAction();
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    async function init() {
      await loadEvents();

      if (!currentPlan) {
        const restored = await restoreSession();

        if (!restored && sessions.length > 0 && sessions[0].plan) {
          loadStaticPlan(sessions[0].plan);
        }
      } else {
        loadStaticPlan(currentPlan);
      }
    }

    init();
  }, [currentPlan, loadStaticPlan, restoreSession, sessions]);

  const displayStatus = progressText ?? modelStatus ?? audioStatus ?? appStatus;

  useEffect(() => {
    if (displayStatus !== "") {
      setCurrentSessionStatus(displayStatus);
    }
  }, [displayStatus, setCurrentSessionStatus]);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "var(--text)", paddingBottom: 180 }}>
      <OffscreenCanvasHost onPayloadChange={setWorkerInitPayload} />
      <Toasts toasts={toasts} />
      <h1>Ambient FM</h1>

      <MainActions
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
      />

      <section className="home-page__preview">
        <h2 className="home-page__preview-title">Composition preview</h2>
        <div className="home-page__preview-grid">
          <div className="home-page__preview-row">
            <span>Total timeline events</span>
            <strong>{compositionPreview.totalEvents}</strong>
          </div>
          <div className="home-page__preview-row">
            <span>Sources</span>
            <strong>{compositionPreview.sourceLabels}</strong>
          </div>
          <div className="home-page__preview-row">
            <span>Manual mood inputs</span>
            <strong>{compositionPreview.manualCount} events</strong>
          </div>
          <div className="home-page__preview-row">
            <span>Average manual strength</span>
            <strong>{Math.round(compositionPreview.manualStrength * 100)}%</strong>
          </div>
        </div>
        <p className="home-page__preview-note">This preview is based on the current timeline and manual mood inputs that will be passed to the generator.</p>
      </section>

      <ModelActions
        availableModels={availableModels}
        selectedModelId={selectedModelId}
        progressText={progressText}
        modelProgress={modelProgress}
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

      <CompositionPlanSummary
        plan={plan}
        runtimeCursor={runtimeState.cursor}
        activeSection={runtimeState.activeSection}
        currentPhraseRole={runtimeState.activePhrase?.role ?? null}
        sectionTimeRemaining={runtimeState.sectionTimeRemaining}
      />

      <section style={{ marginTop: 24, padding: 18, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Recent Sessions</h2>
        {sessions.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {sessions.slice(0, 5).map((session) => (
              <li key={session.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <span>
                  {session.dominantMood} — {Math.round(session.avgBpm)} BPM — {session.key}
                </span>
                <button
                  type="button"
                  disabled={!session.plan}
                  onClick={() => session.plan && loadSessionPlan(session.plan)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: session.plan ? "var(--surface-strong)" : "var(--surface)",
                    color: session.plan ? "var(--text)" : "var(--text-muted)",
                    cursor: session.plan ? "pointer" : "not-allowed",
                  }}
                >
                  Load
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: "var(--text-muted)" }}>No saved session memory yet.</p>
        )}
      </section>

      <RuntimeDiagnostics
        gpuStatus={gpuStatus}
        gpuLimits={gpuLimits}
        runtimeCursor={runtimeState.cursor}
        activeSection={runtimeState.activeSection}
        runtimeIntensity={runtimeState.intensity}
        runtimeDrift={runtimeState.drift}
        runtimeUptime={runtimeState.runtimeUptime}
        frameDelay={runtimeState.frameDelay}
        audioRestartCount={runtimeState.audioRestartCount}
        snapshotCount={runtimeState.snapshotCount}
      />
    </div>
  );
}
