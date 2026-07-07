import { Download, Volume2, Trash2, Loader } from "lucide-react";
import useVoiceManager from "../hooks/useVoiceManager";
import { unlockVoice } from "../audio/host";
import { unlockAudio } from "../audio/toneEngine";
import { card, mutedNote, ghostButton, primaryButton } from "../ui/styles";

// Download / test / remove the on-device Piper DJ voice. Optional — until it's
// downloaded, the host shows as on-screen captions (no system voice).
export default function VoiceActions() {
  const { enabled, status, installed, progress, progressText, download, remove, test } = useVoiceManager();
  const ready = status === "ready";
  const loading = status === "loading";
  const have = ready || installed;

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>DJ voice</span>
          <span style={mutedNote}>
            A natural on-device voice for the radio host. A one-time download that runs offline afterward.
            {enabled && have ? " Active." : " Until it's downloaded, the host shows as captions only."}
          </span>
        </span>
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: have ? "var(--accent)" : status === "error" ? "#c2506f" : "var(--text-faint)" }}>
          {ready ? "Ready" : loading ? "Loading…" : installed ? "Installed" : status === "error" ? "Failed" : "Not installed"}
        </span>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {progress > 0 ? (
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface-muted)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, background: "var(--accent)", transition: "width 0.2s ease" }} />
            </div>
          ) : (
            <div className="afm-bar-indet" style={{ height: 6, borderRadius: 3, background: "var(--surface-muted)" }} />
          )}
          <span style={{ ...mutedNote, fontSize: 11.5 }}>{progressText || "preparing…"}</span>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!have ? (
          <button type="button" onClick={() => { unlockVoice(); unlockAudio(); void download(); }} disabled={loading} style={{ ...primaryButton, opacity: loading ? 0.6 : 1 }}>
            {loading ? <span className="afm-spin"><Loader size={15} /></span> : <Download size={15} />}
            {loading ? "Downloading…" : "Download voice"}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => { unlockVoice(); unlockAudio(); void test(); }} disabled={loading} style={{ ...ghostButton, opacity: loading ? 0.6 : 1 }}>{loading ? <span className="afm-spin"><Loader size={15} /></span> : <Volume2 size={15} />} Test voice</button>
            <button type="button" onClick={() => void remove()} style={{ ...ghostButton, color: "#c2506f", borderColor: "#c2506f55" }}><Trash2 size={15} /> Remove</button>
          </>
        )}
      </div>

      <span style={{ ...mutedNote, fontSize: 11.5 }}>
        Runs on your device (no cloud). If it can't load, the host falls back to captions — never a robotic system voice.
      </span>
    </div>
  );
}
