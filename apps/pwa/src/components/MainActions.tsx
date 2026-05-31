type MainActionsProps = {
  isPlaying: boolean;
  refreshing: boolean;
  aiReady: boolean;
  onPlayToggle: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onGenerate: () => Promise<void> | void;
  onToggleMonitor: () => void;
};

export default function MainActions({
  isPlaying,
  refreshing,
  aiReady,
  onPlayToggle,
  onRefresh,
  onGenerate,
  onToggleMonitor,
}: MainActionsProps) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <button type="button" onClick={onPlayToggle} style={{ fontSize: 16, padding: "12px 18px" }}>
        {isPlaying ? "Stop Test Tone" : "Play Test Tone"}
      </button>
      <button type="button" onClick={onRefresh} disabled={refreshing} style={{ fontSize: 16, padding: "12px 18px" }}>
        {refreshing ? "Refreshing..." : "Refresh Environment"}
      </button>
      <button type="button" onClick={onGenerate} disabled={!aiReady} style={{ fontSize: 16, padding: "12px 18px" }}>
        {aiReady ? "Generate AI Composition" : "Generating..."}
      </button>
      <button type="button" onClick={onToggleMonitor} style={{ fontSize: 16, padding: "12px 18px" }}>
        Toggle Monitor
      </button>
    </div>
  );
}
