import { RefreshCw } from "lucide-react";
import ModelActions from "../components/ModelActions";
import VoiceActions from "../components/VoiceActions";
import ThemeToggle from "../components/ThemeToggle";
import SystemHealth from "../components/SystemHealth";
import StationSettings from "../components/StationSettings";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import { resetApp } from "../utils/resetApp";
import { screen, screenEyebrow, screenTitle, sectionLabel, card, mutedNote, ghostButton } from "../ui/styles";

export default function Settings() {
  const { model, availableModels, selectedModelId, selectModelAction } = useSession();
  const debug = useAppStore((s) => s.debug);
  const setDebug = useAppStore((s) => s.setDebug);

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Settings</span>
        <h1 style={screenTitle}>Your station</h1>
        <p style={mutedNote}>Everything runs on your device. Shape your station, manage the model, and check the engine.</p>
      </div>

      {/* Host — the station identity, host + voice (most-visited) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Host</span>
        <StationSettings />
        <VoiceActions />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Appearance</span>
        <ThemeToggle />
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
            <span style={mutedNote}>Show warnings and errors in an on-screen panel.</span>
          </span>
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--accent)", flexShrink: 0 }} />
        </label>
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-h)" }}>Reset & reload</span>
            <span style={mutedNote}>Reload with the latest version if the app seems out of date. Keeps your sounds and downloaded models.</span>
          </span>
          <button type="button" onClick={() => void resetApp()} style={{ ...ghostButton, flexShrink: 0 }}><RefreshCw size={15} /> Reset</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Diagnostics</span>
        <SystemHealth />
      </div>
    </div>
  );
}
