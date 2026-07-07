import useSystemHealth from "../hooks/useSystemHealth";
import { card, mutedNote } from "../ui/styles";

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid color-mix(in srgb, var(--border) 55%, transparent)" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: ok === false ? "#c2506f" : ok === true ? "var(--accent)" : "var(--text-h)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function SystemHealth() {
  const h = useSystemHealth();
  if (!h) return <div style={{ ...mutedNote, padding: "4px 2px" }}>Reading system health…</div>;

  const storage = h.storageUsedMB != null && h.storageQuotaMB != null
    ? `${h.storageUsedMB} / ${h.storageQuotaMB} MB`
    : "—";

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 0, padding: "6px 14px" }}>
      <Row label="WebGPU" value={h.gpu ? "available" : "unavailable"} ok={h.gpu} />
      <Row label="Audio engine" value={h.audioState} ok={h.audioState === "running" ? true : h.audioState === "suspended" ? undefined : undefined} />
      <Row label="CPU cores" value={h.cores != null ? String(h.cores) : "—"} />
      {h.memoryGB != null ? <Row label="Device memory" value={`${h.memoryGB} GB`} /> : null}
      <Row label="Storage used" value={storage} />
      <Row label="Composer model" value={h.modelLoaded ? "loaded" : h.modelDownloaded ? "downloaded" : "not downloaded"} ok={h.modelLoaded} />
      <Row label="DJ voice" value={h.voiceReady ? "ready" : h.voiceInstalled ? "installed" : "not installed"} ok={h.voiceReady || h.voiceInstalled} />
      <Row label="Network" value={h.online ? "online" : "offline"} ok={h.online} />
      <Row label="Installed as app" value={h.standalone ? "yes" : "browser tab"} />
      <Row label="Library" value={`${h.counts.tracks} tracks · ${h.counts.sounds} sounds`} />
      <Row label="Signals" value={`${h.counts.feedback} feedback · ${h.counts.captures} captures`} />
    </div>
  );
}
