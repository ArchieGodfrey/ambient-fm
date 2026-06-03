import { useState } from "react";
import { getPiperSynth } from "../audio/vocal/piperSynth";
import { stopAudio } from "../audio/toneEngine";
import { stopRuntimeLoop } from "../audio/compositionRuntime";
import { stopComposer } from "../composer/runtime";
import { getVocalLayer } from "../audio/layers/vocal";
import useModelManager from "../hooks/useModelManager";
import useVocalManager from "../hooks/useVocalManager";
import { useRuntimeSnapshot } from "../hooks/useRuntimeSnapshot";
import VocalModelActions from "../components/VocalModelActions";
import RuntimeDiagnostics from "../components/RuntimeDiagnostics";
import { useAppStore } from "../store/useAppStore";
import { getAvailableModels, getSelectedModelId, selectModel } from "../ai/composer";
import { postToast } from "../utils/toast";

type SectionKey = "language-model" | "vocal-model" | "diagnostics" | "emergency";
function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginBottom: 20 }}>
      <button type="button" onClick={onToggle} style={{ width: "100%", background: "none", border: "none", padding: "0 0 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>{title}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ "language-model": true, "vocal-model": true, diagnostics: true, emergency: false });
  const toggle = (k: SectionKey) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const [selectedModelId, setSelectedModelId] = useState(getSelectedModelId());
  const availableModels = getAvailableModels();
  const composerVoice = useAppStore((s) => s.composerSettings.vocalVoice);
  const isPiperVoice = composerVoice.startsWith('piper_');
  const isKokoroVoice = !isPiperVoice && composerVoice !== 'browser' && composerVoice !== 'ai';
  const { modelDownloaded, modelLoaded, modelProgress, progressText, gpuStatus, gpuLimits, downloadModelAction, loadModelAction, unloadModelAction, resetRuntimeAction, deleteModelAction, checkModelState } = useModelManager(undefined);
  const { stage: vocalStage, progress: vocalProgress, statusText: vocalStatusText, error: vocalError, loadAction: loadVocalAction, unloadAction: unloadVocalAction, clearAudioCacheAction, cancelAction, deleteModelCacheAction } = useVocalManager();
  const snapshot = useRuntimeSnapshot();

  const sel: React.CSSProperties = { fontSize: 13, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-strong)", color: "var(--text)" };
  const btn: React.CSSProperties = { fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-strong)", color: "var(--text)", cursor: "pointer" };

  return (
    <div style={{ padding: "20px 20px 180px", maxWidth: 720, margin: "0 auto", color: "var(--text)" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Settings</h1>

      {/* Language Model */}
      <Section title="Language Model" open={open["language-model"]} onToggle={() => toggle("language-model")}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--text)" }}>Model</span>
            <select value={selectedModelId} style={sel} onChange={async e => {
              const id = e.target.value;
              if (id === selectedModelId) return;
              const label = availableModels.find(m => m.model_id === id)?.label ?? id;
              await resetRuntimeAction(); selectModel(id); setSelectedModelId(id); await checkModelState();
              postToast(`Selected ${label}`, "success");
            }}>
              {availableModels.map(m => <option key={m.model_id} value={m.model_id}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {progressText || (modelLoaded ? "Loaded and ready" : modelDownloaded ? "Downloaded, not loaded" : "Not downloaded")}
          </div>
          {modelProgress != null && (
            <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ width: `${Math.round(modelProgress * 100)}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s" }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            <button type="button" style={btn} onClick={() => { if (!modelDownloaded) { downloadModelAction(); } else if (modelLoaded) { unloadModelAction(); } else { loadModelAction(); } }}>
              {!modelDownloaded ? "Download model" : modelLoaded ? "Unload model" : "Load model"}
            </button>
            <button type="button" style={{ ...btn, color: "var(--text-muted)" }} onClick={deleteModelAction}>Delete cache</button>
            <button type="button" style={{ ...btn, color: "var(--text-muted)" }} onClick={resetRuntimeAction}>Reset runtime</button>
          </div>
        </div>
      </Section>

            {/* Vocal Model */}
      <Section title={isPiperVoice ? "Vocal Model (Piper TTS)" : isKokoroVoice ? "Vocal Model (Kokoro TTS)" : "Vocal Model"} open={open["vocal-model"]} onToggle={() => toggle("vocal-model")}>
        <div style={{ display: "grid", gap: 16 }}>
          {isPiperVoice ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Piper TTS is active — fast CPU synthesis (~1–5s on device). Voice model downloads on first use (~60 MB via HuggingFace).
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => getPiperSynth().clearMemoryCache()} style={{ ...btn, color: "var(--text-muted)" }}>Clear memory cache</button>
              </div>
            </div>
          ) : isKokoroVoice ? (
            <>
              <VocalModelActions stage={vocalStage} progress={vocalProgress} statusText={vocalStatusText} error={vocalError} onLoad={loadVocalAction} onUnload={unloadVocalAction} onClearCache={clearAudioCacheAction} onCancel={cancelAction} />
              <div style={{ paddingTop: 4 }}>
                <button type="button" onClick={() => void deleteModelCacheAction()} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  Delete downloaded model
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Using Browser Voice — no model needed. Switch to a Piper or Kokoro voice to enable AI synthesis.
            </div>
          )}
        </div>
      </Section>

      {/* Diagnostics */}
      <Section title="Runtime Diagnostics" open={open.diagnostics} onToggle={() => toggle("diagnostics")}>
        <RuntimeDiagnostics gpuStatus={gpuStatus} gpuLimits={gpuLimits} runtimeCursor={snapshot.cursor} activeSection={snapshot.activeSection} runtimeIntensity={snapshot.intensity} runtimeDrift={snapshot.drift} runtimeUptime={snapshot.runtimeUptime} frameDelay={snapshot.frameDelay} audioRestartCount={snapshot.audioRestartCount} snapshotCount={snapshot.snapshotCount} />
      </Section>

      {/* Emergency */}
      <Section title="Emergency Controls" open={open.emergency} onToggle={() => toggle("emergency")}>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10 }}>
          {([
            ["Stop Audio", () => { stopAudio(); stopRuntimeLoop(); stopComposer(); }],
            ["Stop Vocals", () => { getVocalLayer().stop(); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }],
            ["Unload All", async () => { await unloadModelAction(); unloadVocalAction(); }],
          ] as [string, () => void | Promise<void>][]).map(([label, action]) => (
            <button key={label} type="button" onClick={() => void action()} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "1px solid #f87171", background: "rgba(248,113,113,0.08)", color: "#f87171", cursor: "pointer", fontWeight: 600 }}>
              {label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
