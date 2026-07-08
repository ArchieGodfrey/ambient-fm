import { useState } from "react";
import { RefreshCw, Loader, Square } from "lucide-react";
import ModelActions from "../components/ModelActions";
import VoiceActions from "../components/VoiceActions";
import ThemeToggle from "../components/ThemeToggle";
import SystemHealth from "../components/SystemHealth";
import StationSettings from "../components/StationSettings";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import { resetApp } from "../utils/resetApp";
import { renderTrack } from "../audio/renderTrack";
import { playRenderedBlob, stopRenderedBlob, unlockRenderedPlayer } from "../audio/renderedPlayer";
import { screen, screenEyebrow, screenTitle, sectionLabel, card, mutedNote, ghostButton } from "../ui/styles";

export default function Settings() {
  const { model, audio, radio, availableModels, selectedModelId, selectModelAction } = useSession();
  const debug = useAppStore((s) => s.debug);
  const setDebug = useAppStore((s) => s.setDebug);
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);

  // Test the pre-rendered background path: render the current track to audio and
  // play it through a media element (which iOS keeps alive when locked). Lets us
  // validate render faithfulness + locked playback before rewiring the radio.
  const testRender = async () => {
    const plan = useAppStore.getState().currentPlan;
    if (!plan) { setRenderStatus("No track loaded to render — burn one first."); return; }
    unlockRenderedPlayer(); // unlock the media element within this tap
    if (radio.isOn) radio.tuneOut(); else audio.stopPlayback();
    setRendering(true);
    setRenderStatus("Rendering…");
    try {
      const blob = await renderTrack(plan);
      playRenderedBlob(blob);
      setRenderStatus("Playing the rendered track — lock the phone to test.");
    } catch (e) {
      setRenderStatus(`Render failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRendering(false);
    }
  };

  const stopTest = () => { stopRenderedBlob(); setRenderStatus(null); };

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Settings</span>
        <h1 style={screenTitle}>The composer</h1>
        <p style={mutedNote}>The AI runs entirely on your device. Manage the model and inspect the engine here.</p>
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
        <span style={sectionLabel}>Station & host</span>
        <StationSettings />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Voice host</span>
        <VoiceActions />
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
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-h)" }}>Test background render</span>
            <span style={mutedNote}>Render the current track to audio and play it through a media element — then lock the phone. Validates the pre-render approach (does it sound right, does it survive lock).</span>
            {renderStatus ? <span style={{ ...mutedNote, color: "var(--accent)" }}>{renderStatus}</span> : null}
          </span>
          <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={() => void testRender()} disabled={rendering} style={{ ...ghostButton, opacity: rendering ? 0.6 : 1 }}>
              {rendering ? <span className="afm-spin"><Loader size={15} /></span> : null} {rendering ? "Rendering…" : "Render & play"}
            </button>
            <button type="button" onClick={stopTest} style={ghostButton}><Square size={15} /></button>
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Diagnostics</span>
        <SystemHealth />
      </div>
    </div>
  );
}
