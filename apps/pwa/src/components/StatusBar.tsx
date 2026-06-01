import type { CSSProperties } from "react";

const statusStyle: CSSProperties = {
  marginBottom: 24,
  padding: 16,
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--surface)",
};

export default function StatusBar({
  status,
  aiStatus,
  modelLoaded,
  modelDownloaded,
  modelProgress,
}: {
  status: string;
  aiStatus: string;
  modelLoaded: boolean;
  modelDownloaded: boolean;
  modelProgress: number | null;
}) {
  return (
    <div style={statusStyle}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{status}</div>
      <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
        AI: {aiStatus} · Model: {modelLoaded ? "loaded" : modelDownloaded ? "downloaded" : "not downloaded"}
        {modelProgress !== null ? ` · Progress: ${Math.round(modelProgress * 100)}%` : ""}
      </div>
    </div>
  );
}
