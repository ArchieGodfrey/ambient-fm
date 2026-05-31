type MainActionsProps = {
  isPlaying: boolean;
  refreshing: boolean;
  aiReady: boolean;
  modelLoaded: boolean;
  onPlayToggle: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onGenerate: () => Promise<void> | void;
};

export default function MainActions({
  isPlaying,
  refreshing,
  aiReady,
  modelLoaded,
  onPlayToggle,
  onRefresh,
  onGenerate,
}: MainActionsProps) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <button type="button" onClick={onPlayToggle} style={{ fontSize: 16, padding: "12px 18px" }}>
        {isPlaying ? "Stop" : "Play"}
      </button>
      <button type="button" onClick={onRefresh} disabled={refreshing} style={{ fontSize: 16, padding: "12px 18px" }}>
        {refreshing ? "Refreshing..." : "Refresh Environment"}
      </button>
      {modelLoaded && (
        <button type="button" onClick={onGenerate} disabled={!aiReady} style={{ fontSize: 16, padding: "12px 18px" }}>
          {aiReady ? "Generate AI Composition" : "Generating..."}
        </button>
      )}
    </div>
  );
}
