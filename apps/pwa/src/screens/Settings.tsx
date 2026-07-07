import ModelActions from "../components/ModelActions";
import RuntimeDiagnostics from "../components/RuntimeDiagnostics";
import { useSession } from "../session/SessionProvider";
import { screen, screenEyebrow, screenTitle, sectionLabel, mutedNote } from "../ui/styles";

export default function Settings() {
  const { model, audio, availableModels, selectedModelId, selectModelAction } = useSession();
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
