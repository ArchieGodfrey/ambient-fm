import { useState } from "react";
import { RefreshCw, Power } from "lucide-react";
import ModelActions from "../components/ModelActions";
import VoiceActions from "../components/VoiceActions";
import ThemeToggle from "../components/ThemeToggle";
import SystemHealth from "../components/SystemHealth";
import StationSettings from "../components/StationSettings";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import { resetApp } from "../utils/resetApp";
import { parkAudioContext } from "../audio/toneEngine";
import { suspendVoice } from "../audio/hostPiper";
import { stopBed } from "../audio/bedPlayer";
import { screen, screenEyebrow, screenTitle, sectionLabel, card, mutedNote, ghostButton } from "../ui/styles";

export default function Settings() {
  const { model, audio, radio, availableModels, selectedModelId, selectModelAction } = useSession();
  const debug = useAppStore((s) => s.debug);
  const setDebug = useAppStore((s) => s.setDebug);
  const [powerStatus, setPowerStatus] = useState<string | null>(null);

  // Return the phone to a normal state: stop the radio + all playback, tear down
  // the AI runtime (frees the model/GPU; also unsticks it), and suspend the audio
  // contexts so nothing keeps running. Everything spins back up on the next tune-in.
  const switchEverythingOff = async () => {
    setPowerStatus("Switching everything off…");
    try { if (radio.isOn) radio.tuneOut(); } catch { /* ignore */ }
    try { audio.stopPlayback(); } catch { /* ignore */ }
    try { stopBed(); } catch { /* ignore */ }
    try { suspendVoice(); } catch { /* ignore */ }
    try { await model.resetRuntimeAction(); } catch { /* ignore */ }
    try { await parkAudioContext(); } catch { /* ignore */ }
    setPowerStatus("Everything's off. Safe to leave — it'll spin back up when you tune in.");
  };

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
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-h)" }}>Switch everything off</span>
            <span style={mutedNote}>Stop the radio and all audio, tear down the AI runtime (frees memory, unsticks generation), and idle the audio engine — returns the phone to a normal state.</span>
            {powerStatus ? <span style={{ ...mutedNote, color: "var(--accent)" }}>{powerStatus}</span> : null}
          </span>
          <button type="button" onClick={() => void switchEverythingOff()} style={{ ...ghostButton, flexShrink: 0 }}><Power size={15} /> Off</button>
        </div>
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-h)" }}>Reset & reload</span>
            <span style={mutedNote}>Reload with the latest version if the app seems out of date. Keeps your sounds and downloaded models.</span>
          </span>
          <button type="button" onClick={() => void resetApp()} style={{ ...ghostButton, flexShrink: 0 }}><RefreshCw size={15} /> Reload</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Diagnostics</span>
        <SystemHealth />
      </div>
    </div>
  );
}
