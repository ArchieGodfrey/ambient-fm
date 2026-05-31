import type { CSSProperties } from "react";

type Props = {
  gpuStatus: string | null;
  gpuLimits: {
    maxBufferSizeMB: number;
    maxStorageBufferBindingSizeMB: number;
    maxComputeWorkgroupStorageSize: number;
  } | null;
  heapUsage: string | null;
  runtimeCursor?: number;
  activeSection?: { mood: string } | null;
  runtimeIntensity?: number;
  runtimeDrift?: number;
};

const diagnosticsStyle: CSSProperties = {
  marginBottom: 24,
  padding: 16,
  border: "1px solid #ddd",
  borderRadius: 12,
  background: "#f9fafb",
};

const labelStyle: CSSProperties = {
  fontWeight: 700,
  marginBottom: 8,
};

export default function RuntimeDiagnostics({ gpuStatus, gpuLimits, heapUsage, runtimeCursor, activeSection, runtimeIntensity, runtimeDrift }: Props) {
  return (
    <div style={diagnosticsStyle}>
      <div style={labelStyle}>Runtime diagnostics</div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        {gpuStatus ?? "No GPU diagnostics available"}
      </div>
      {gpuLimits ? (
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          <div>GPU max buffer: {gpuLimits.maxBufferSizeMB.toFixed(0)} MB</div>
          <div>GPU max storage binding: {gpuLimits.maxStorageBufferBindingSizeMB.toFixed(0)} MB</div>
          <div>GPU compute workgroup storage: {gpuLimits.maxComputeWorkgroupStorageSize} bytes</div>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "#666" }}>GPU limits not available yet.</div>
      )}
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        <div><strong>Time Cursor:</strong> {runtimeCursor?.toFixed(1) ?? "0.0"}s</div>
        <div><strong>Active Section:</strong> {activeSection?.mood ?? "None"}</div>
        <div><strong>Intensity:</strong> {runtimeIntensity?.toFixed(2) ?? "0.00"}</div>
        <div><strong>Drift:</strong> {runtimeDrift?.toFixed(3) ?? "0.000"}</div>
      </div>
      <div style={{ fontSize: 14, marginTop: 8 }}>JS Heap: {heapUsage ?? "Unavailable"}</div>
    </div>
  );
}
