import { useState } from "react";
import type { CSSProperties } from "react";

type Props = {
  gpuStatus: string | null;
  gpuLimits: {
    maxBufferSizeMB: number;
    maxStorageBufferBindingSizeMB: number;
    maxComputeWorkgroupStorageSize: number;
  } | null;
  runtimeCursor?: number;
  activeSection?: { mood: string } | null;
  runtimeIntensity?: number;
  runtimeDrift?: number;
  runtimeUptime?: number;
  frameDelay?: number;
  audioRestartCount?: number;
  snapshotCount?: number;
};

const diagnosticsStyle: CSSProperties = {
  marginTop: 24,
  marginBottom: 24,
  padding: 16,
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--surface)",
};

const labelStyle: CSSProperties = {
  fontWeight: 700,
  marginBottom: 8,
};

export default function RuntimeDiagnostics({ gpuStatus, gpuLimits, runtimeCursor, activeSection, runtimeIntensity, runtimeDrift, runtimeUptime, frameDelay, audioRestartCount, snapshotCount }: Props) {
  const [open, setOpen] = useState(false);
  const hasDiagnostics =
    gpuStatus !== null ||
    gpuLimits !== null ||
    activeSection !== null ||
    runtimeCursor !== 0 ||
    runtimeIntensity !== 0 ||
    runtimeDrift !== 0 ||
    runtimeUptime !== 0 ||
    frameDelay !== 0 ||
    audioRestartCount !== 0 ||
    snapshotCount !== 0;

  if (!hasDiagnostics) {
    return null;
  }

  return (
    <div style={diagnosticsStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={labelStyle}>Runtime diagnostics</div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-strong)", color: "var(--text)", cursor: "pointer" }}
        >
          {open ? "Hide details" : "Show details"}
        </button>
      </div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        {gpuStatus ?? "No GPU diagnostics available"}
      </div>
      {open ? (
        <>
          {gpuLimits ? (
            <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
              <div>GPU max buffer: {gpuLimits.maxBufferSizeMB.toFixed(0)} MB</div>
              <div>GPU max storage binding: {gpuLimits.maxStorageBufferBindingSizeMB.toFixed(0)} MB</div>
              <div>GPU compute workgroup storage: {gpuLimits.maxComputeWorkgroupStorageSize} bytes</div>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>GPU limits not available yet.</div>
          )}
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            <div><strong>Time Cursor:</strong> {runtimeCursor?.toFixed(1) ?? "0.0"}s</div>
            <div><strong>Active Section:</strong> {activeSection?.mood ?? "None"}</div>
            <div><strong>Intensity:</strong> {runtimeIntensity?.toFixed(2) ?? "0.00"}</div>
            <div><strong>Drift:</strong> {runtimeDrift?.toFixed(3) ?? "0.000"}</div>
            <div><strong>Uptime:</strong> {runtimeUptime?.toFixed(1) ?? "0.0"}s</div>
            <div><strong>Frame delay:</strong> {frameDelay?.toFixed(1) ?? "0.0"}ms</div>
            <div><strong>Audio restarts:</strong> {audioRestartCount ?? 0}</div>
            <div><strong>Snapshot count:</strong> {snapshotCount ?? 0}</div>
          </div>
        </>
      ) : null}
    </div>
  );
}
