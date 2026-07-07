import ModelActions from "../components/ModelActions";
import RuntimeDiagnostics from "../components/RuntimeDiagnostics";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import { screen, screenEyebrow, screenTitle, sectionLabel, card, mutedNote } from "../ui/styles";

export default function Settings() {
  const { model, audio, availableModels, selectedModelId, selectModelAction } = useSession();
  const debug = useAppStore((s) => s.debug);
  const setDebug = useAppStore((s) => s.setDebug);
  const rt = audio.runtimeState;

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Settings</span>
        <h1 style={screenTitle}>The composer</h1>
        <p style={mutedNote}>The AI runs entirely on your device. Manage the model and inspect the engine here.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Model</span>
        {model.status && model.status !== "Ready" ? (
          <div
            style={{
              fontSize: 13, lineHeight: 1.5, padding: "12px 14px", borderRadius: "var(--radius)",
              border: "1px solid", ...(/fail|error|too low|unavailable/i.test(model.status)
                ? { color: "#c2506f", borderColor: "#c2506f55", background: "#c2506f14" }
                : { color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--surface)" }),
            }}
          >
            {model.status}
          </div>
        ) : null}
        <ModelActions
          availableModels={availableModels}
          selectedModelId={selectedModelId}
          progressText={model.progressText}
          modelProgress={model.modelProgress}
          onSelectModel={(id) => void selectModelAction(id)}
          modelLoaded={model.modelLoaded}
          modelDownloaded={model.modelDownloaded}
          onDownload={model.downloadModelAction}
          onLoad={model.loadModelAction}
          onUnload={model.unloadModelAction}
          onDelete={model.deleteModelAction}
          onResetRuntime={model.resetRuntimeAction}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Developer</span>
        <label style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, cursor: "pointer" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-h)" }}>Show debug log</span>
            <span style={mutedNote}>Surface warnings and errors in an on-screen panel. Off by default — the disc shows burn progress.</span>
          </span>
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--accent)", flexShrink: 0 }} />
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Diagnostics</span>
        <RuntimeDiagnostics
          gpuStatus={model.gpuStatus}
          gpuLimits={model.gpuLimits}
          runtimeCursor={rt.cursor}
          activeSection={rt.activeSection}
          runtimeIntensity={rt.intensity}
          runtimeDrift={rt.drift}
          runtimeUptime={rt.runtimeUptime}
          frameDelay={rt.frameDelay}
          audioRestartCount={rt.audioRestartCount}
          snapshotCount={rt.snapshotCount}
        />
      </div>
    </div>
  );
}
