import { Download, Cpu, Trash2, RotateCcw, Loader } from "lucide-react";
import { card, mutedNote, primaryButton, ghostButton } from "../ui/styles";

type ModelOption = { label: string; model_id: string };

type ModelActionsProps = {
  availableModels: ModelOption[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  modelLoaded: boolean;
  modelDownloaded: boolean;
  modelProgress: number | null;
  progressText: string | null;
  onDownload: () => Promise<boolean> | void;
  onLoad: () => Promise<boolean> | void;
  onUnload: () => Promise<boolean> | void;
  onDelete: () => Promise<void> | void;
  onResetRuntime: () => Promise<void> | void;
};

// The on-device model, styled to match VoiceActions (one card, a status pill, a
// primary action + secondary ghost actions) so the two management sections read
// as one system.
export default function ModelActions({
  availableModels, selectedModelId, onSelectModel,
  modelLoaded, modelDownloaded, modelProgress, progressText,
  onDownload, onLoad, onUnload, onDelete, onResetRuntime,
}: ModelActionsProps) {
  const loading = modelProgress != null && modelProgress < 1;
  const statusLabel = loading ? "Loading…" : modelLoaded ? "Loaded" : modelDownloaded ? "Downloaded" : "Not downloaded";
  const statusColor = modelLoaded || modelDownloaded ? "var(--accent)" : "var(--text-faint)";
  const primaryLabel = !modelDownloaded ? "Download model" : modelLoaded ? "Unload" : "Load model";

  const handlePrimary = () => {
    if (!modelDownloaded) { onDownload(); return; }
    if (modelLoaded) { onUnload(); return; }
    onLoad();
  };

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>AI model</span>
          <span style={mutedNote}>The on-device composer. Downloads once, then runs offline.</span>
        </span>
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ ...mutedNote, fontSize: 11.5 }}>Model</span>
        <select value={selectedModelId} onChange={(e) => onSelectModel(e.target.value)}
          style={{ fontSize: 14, padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface-strong)", color: "var(--text)" }}>
          {availableModels.map((m) => <option key={m.model_id} value={m.model_id}>{m.label}</option>)}
        </select>
      </label>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 6, borderRadius: 3, background: "var(--surface-muted)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round((modelProgress ?? 0) * 100)}%`, background: "var(--accent)", transition: "width 0.2s ease" }} />
          </div>
          <span style={{ ...mutedNote, fontSize: 11.5 }}>{progressText || "working…"}</span>
        </div>
      ) : progressText ? <span style={{ ...mutedNote, fontSize: 11.5 }}>{progressText}</span> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={handlePrimary} disabled={loading} style={{ ...primaryButton, opacity: loading ? 0.6 : 1 }}>
          {loading ? <span className="afm-spin"><Loader size={15} /></span> : !modelDownloaded ? <Download size={15} /> : <Cpu size={15} />}
          {loading ? "Working…" : primaryLabel}
        </button>
        {modelDownloaded ? (
          <button type="button" onClick={() => onDelete()} style={{ ...ghostButton, color: "#c2506f", borderColor: "#c2506f55" }}><Trash2 size={15} /> Delete</button>
        ) : null}
        <button type="button" onClick={() => onResetRuntime()} style={ghostButton}><RotateCcw size={15} /> Reset</button>
      </div>
    </div>
  );
}
