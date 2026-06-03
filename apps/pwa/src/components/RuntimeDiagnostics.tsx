import { useEffect, useState } from "react";

type Props = {
  gpuStatus: string | null;
  gpuLimits: { maxBufferSizeMB: number; maxStorageBufferBindingSizeMB: number; maxComputeWorkgroupStorageSize: number } | null;
  runtimeCursor?: number;
  activeSection?: { mood: string } | null;
  runtimeIntensity?: number;
  runtimeDrift?: number;
  runtimeUptime?: number;
  frameDelay?: number;
  audioRestartCount?: number;
  snapshotCount?: number;
};

type HeapInfo = { usedMB: number; totalMB: number; pct: number } | null;

function useHeap(): HeapInfo {
  const [heap, setHeap] = useState<HeapInfo>(null);
  useEffect(() => {
    const read = () => {
      const mem = (performance as any).memory;
      if (!mem) return;
      const usedMB = mem.usedJSHeapSize / 1048576;
      const totalMB = mem.jsHeapSizeLimit / 1048576;
      setHeap({ usedMB, totalMB, pct: usedMB / totalMB });
    };
    read();
    const t = setInterval(read, 3000);
    return () => clearInterval(t);
  }, []);
  return heap;
}

function Bar({ value, warn = 0.75, danger = 0.9 }: { value: number; warn?: number; danger?: number }) {
  const color = value > danger ? '#f87171' : value > warn ? '#fbbf24' : '#4ade80';
  return (
    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(Math.min(1, value) * 100)}%`, height: '100%', background: color, transition: 'width 0.5s' }} />
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 120, flexShrink: 0 }}>{label}</span>
      {children ?? <span style={{ fontSize: 12, color: 'var(--text)' }}>{value ?? '—'}</span>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

export default function RuntimeDiagnostics({ gpuStatus, gpuLimits, runtimeCursor, activeSection, runtimeIntensity, runtimeDrift, runtimeUptime, frameDelay, audioRestartCount, snapshotCount }: Props) {
  const heap = useHeap();
  const sab = typeof SharedArrayBuffer !== 'undefined';
  const fps = frameDelay != null ? Math.round(1000 / Math.max(1, 16 + frameDelay)) : null;

  return (
    <div style={{ fontSize: 13 }}>

      {/* System */}
      <Group title="System">
        <Row label="Multi-threading">
          <span style={{ fontSize: 12, fontWeight: 600, color: sab ? '#4ade80' : '#f87171' }}>
            {sab ? '✓ Available' : '✗ Unavailable'}
          </span>
          {!sab && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>COOP/COEP headers missing</span>}
        </Row>
        {heap && (
          <Row label="JS heap">
            <Bar value={heap.pct} />
            <span style={{ fontSize: 12, color: 'var(--text)', minWidth: 120, textAlign: 'right' }}>
              {heap.usedMB.toFixed(0)} / {heap.totalMB.toFixed(0)} MB ({Math.round(heap.pct * 100)}%)
            </span>
          </Row>
        )}
        <Row label="Frame delay" value={frameDelay != null ? `${frameDelay.toFixed(1)}ms  (~${fps} fps)` : undefined} />
        <Row label="Uptime" value={runtimeUptime != null ? `${runtimeUptime.toFixed(0)}s` : undefined} />
      </Group>

      {/* Audio */}
      <Group title="Audio">
        <Row label="Cursor">
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{runtimeCursor?.toFixed(1) ?? '0.0'}s</span>
          {activeSection && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>· {activeSection.mood}</span>}
        </Row>
        <Row label="Intensity / drift" value={runtimeIntensity != null ? `${runtimeIntensity.toFixed(2)}  /  ${runtimeDrift?.toFixed(3)}` : undefined} />
        <Row label="Audio restarts" value={String(audioRestartCount ?? 0)} />
        <Row label="Snapshots saved" value={String(snapshotCount ?? 0)} />
      </Group>

      {/* GPU */}
      {(gpuStatus || gpuLimits) && (
        <Group title="GPU">
          {gpuStatus && <Row label="Status" value={gpuStatus} />}
          {gpuLimits && (
            <>
              <Row label="Max buffer" value={`${gpuLimits.maxBufferSizeMB.toFixed(0)} MB`} />
              <Row label="Max storage bind" value={`${gpuLimits.maxStorageBufferBindingSizeMB.toFixed(0)} MB`} />
            </>
          )}
        </Group>
      )}
    </div>
  );
}
