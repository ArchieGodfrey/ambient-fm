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
  onDownload: () => Promise<void> | void;
  onLoad: () => Promise<void> | void;
  onUnload: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onResetRuntime: () => Promise<void> | void;
};

export default function ModelActions({
  availableModels,
  selectedModelId,
  onSelectModel,
  modelLoaded,
  modelDownloaded,
  onDownload,
  onLoad,
  onUnload,
  onDelete,
  onResetRuntime,
}: ModelActionsProps) {
  const primaryLabel = !modelDownloaded
    ? "Download Model"
    : modelLoaded
    ? "Unload Model"
    : "Load Model";

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

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        Model:
        <select
          value={selectedModelId}
          onChange={(event) => onSelectModel(event.target.value)}
          style={{ fontSize: 14, padding: "10px 16px" }}
        >
          {availableModels.map((model) => (
            <option key={model.model_id} value={model.model_id}>
              {model.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={handlePrimaryAction} style={{ fontSize: 14, padding: "10px 16px" }}>
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!modelDownloaded || modelLoaded}
        style={{ fontSize: 14, padding: "10px 16px" }}
      >
        Delete Model Cache
      </button>
      <button type="button" onClick={onResetRuntime} style={{ fontSize: 14, padding: "10px 16px" }}>
        Reset Runtime
      </button>
    </div>
  );
}
