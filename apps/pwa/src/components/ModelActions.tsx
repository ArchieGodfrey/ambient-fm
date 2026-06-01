import { useState } from "react";

type ModelOption = {
  label: string;
  model_id: string;
};

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

export default function ModelActions({
  availableModels,
  selectedModelId,
  onSelectModel,
  modelLoaded,
  modelDownloaded,
  modelProgress,
  progressText,
  onDownload,
  onLoad,
  onUnload,
  onDelete,
  onResetRuntime,
}: ModelActionsProps) {
  const [expanded, setExpanded] = useState(false);
  const primaryLabel = !modelDownloaded ? "Download model" : modelLoaded ? "Unload model" : "Load model";

  const handlePrimaryAction = () => {
    if (!modelDownloaded) {
      onDownload();
      return;
    }
    if (modelLoaded) {
      onUnload();
      return;
    }
    onLoad();
  };

  const showBadge = progressText != null && progressText !== "Model loaded" && progressText !== "Model already cached";
  const badgeLabel = progressText ?? (modelLoaded ? "Loaded" : modelDownloaded ? "Downloaded" : "Not downloaded");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto 16px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-strong)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          border: "none",
          background: "var(--surface)",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text)",
        }}
      >
        <span>
          Model: {availableModels.find((model) => model.model_id === selectedModelId)?.label ?? selectedModelId}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {showBadge ? (
            <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--accent-bg)", color: "var(--accent)", fontSize: 12, fontWeight: 700 }}>
              {badgeLabel}
            </span>
          ) : (
            <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--surface)", color: "var(--text-muted)", fontSize: 12 }}>
              {badgeLabel}
            </span>
          )}
          <span>{expanded ? "▲" : "▼"}</span>
        </span>
      </button>
      {expanded ? (
        <>
          <div style={{ display: "grid", gap: 12, padding: "16px 18px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              Select model
              <select
                value={selectedModelId}
                onChange={(event) => onSelectModel(event.target.value)}
                style={{ fontSize: 14, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-strong)", color: "var(--text)" }}
              >
                {availableModels.map((model) => (
                  <option key={model.model_id} value={model.model_id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 14px", borderRadius: 12, background: "var(--surface-strong)", border: "1px solid var(--border)" }}>
              {progressText || (modelLoaded ? "Model loaded" : modelDownloaded ? "Ready to load" : "Model is not downloaded")}
            </div>
            {modelProgress != null ? (
              <div style={{ width: "100%", height: 8, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
                <div style={{ width: `${Math.round(modelProgress * 100)}%`, height: "100%", background: "var(--text-h)" }} />
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <button type="button" onClick={handlePrimaryAction} style={{ fontSize: 14, padding: "10px 16px" }}>
                {primaryLabel}
              </button>
              <button type="button" onClick={onDelete} style={{ fontSize: 14, padding: "10px 16px" }}>
                Delete cache
              </button>
              <button type="button" onClick={onResetRuntime} style={{ fontSize: 14, padding: "10px 16px" }}>
                Reset runtime
              </button>
            </div>
          </div>

        </>
      ) : null}
    </div>
  );
}
