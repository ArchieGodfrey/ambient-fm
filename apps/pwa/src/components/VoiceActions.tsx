import { Download, Volume2, Trash2, Loader } from "lucide-react";
import useKokoroManager from "../hooks/useKokoroManager";
import { card, mutedNote, ghostButton, primaryButton } from "../ui/styles";

// Download / enable / test / remove the optional Kokoro neural DJ voice. It's
// opt-in (an ~80MB model) so it never loads unprompted — until it's downloaded,
// the station uses the device's built-in speech voice.
export default function VoiceActions() {
  const { enabled, status, progress, progressText, download, remove, test } = useKokoroManager();
  const ready = status === "ready";
  const loading = status === "loading";

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>Neural DJ voice (Kokoro)</span>
          <span style={mutedNote}>
            A warmer host voice than the built-in one. ~80MB, downloaded once and cached, runs on-device.
            {enabled && ready ? " Active." : " The station uses the built-in voice until this is downloaded."}
          </span>
        </span>
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: ready ? "var(--accent)" : status === "error" ? "#c2506f" : "var(--text-faint)" }}>
          {ready ? "Ready" : loading ? "Loading…" : status === "error" ? "Failed" : "Not installed"}
        </span>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 6, borderRadius: 3, background: "var(--surface-muted)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: "var(--accent)", transition: "width 0.2s ease" }} />
          </div>
          <span style={{ ...mutedNote, fontSize: 11.5 }}>{progressText || "preparing…"}</span>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!ready ? (
          <button type="button" onClick={() => void download()} disabled={loading} style={{ ...primaryButton, opacity: loading ? 0.6 : 1 }}>
            {loading ? <Loader size={15} /> : <Download size={15} />}
            {loading ? "Downloading…" : "Download voice"}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => void test()} style={ghostButton}><Volume2 size={15} /> Test voice</button>
            <button type="button" onClick={() => void remove()} style={{ ...ghostButton, color: "#c2506f", borderColor: "#c2506f55" }}><Trash2 size={15} /> Remove</button>
          </>
        )}
      </div>

      <span style={{ ...mutedNote, fontSize: 11.5 }}>
        On iPhone this runs in a lighter compatibility mode; if it can't load, the built-in voice is used automatically.
      </span>
    </div>
  );
}
