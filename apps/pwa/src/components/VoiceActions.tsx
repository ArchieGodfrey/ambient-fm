import { Download, Volume2, Trash2, Loader } from "lucide-react";
import useKokoroManager from "../hooks/useKokoroManager";
import { unlockVoice } from "../audio/host";
import { unlockAudio } from "../audio/toneEngine";
import { card, mutedNote, ghostButton, primaryButton } from "../ui/styles";

// Download / enable / test / remove the optional Kokoro neural DJ voice. It's
// opt-in (an ~80MB model) so it never loads unprompted — until it's downloaded,
// the station uses the device's built-in speech voice.
export default function VoiceActions() {
  const { enabled, status, installed, supported, progress, progressText, download, remove, test } = useKokoroManager();
  const ready = status === "ready";
  const loading = status === "loading";
  const have = ready || installed; // downloaded before (may need a quick load from cache)

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>Neural DJ voice (Kokoro)</span>
          <span style={mutedNote}>
            A warmer, more natural DJ voice. A one-time download that runs on your device.
            {enabled && ready ? " Active." : " Until it's downloaded, the station uses the built-in voice."}
          </span>
        </span>
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: !supported ? "var(--text-faint)" : ready || installed ? "var(--accent)" : status === "error" ? "#c2506f" : "var(--text-faint)" }}>
          {!supported ? "Unavailable here" : ready ? "Ready" : loading ? "Loading…" : installed ? "Installed" : status === "error" ? "Failed" : "Not installed"}
        </span>
      </div>

      {supported && loading ? (
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

      {supported ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!have ? (
            <button type="button" onClick={() => { unlockVoice(); unlockAudio(); void download(); }} disabled={loading} style={{ ...primaryButton, opacity: loading ? 0.6 : 1 }}>
              {loading ? <span className="afm-spin"><Loader size={15} /></span> : <Download size={15} />}
              {loading ? "Downloading…" : "Download voice"}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => { unlockVoice(); void test(); }} disabled={loading} style={{ ...ghostButton, opacity: loading ? 0.6 : 1 }}>{loading ? <span className="afm-spin"><Loader size={15} /></span> : <Volume2 size={15} />} Test voice</button>
              <button type="button" onClick={() => void remove()} style={{ ...ghostButton, color: "#c2506f", borderColor: "#c2506f55" }}><Trash2 size={15} /> Remove</button>
            </>
          )}
        </div>
      ) : null}

      <span style={{ ...mutedNote, fontSize: 11.5 }}>
        {supported
          ? "If it can't load on your device, the built-in voice is used automatically."
          : "This voice can't run on iPhone/iPad yet, so the station uses the built-in system voice there."}
      </span>
    </div>
  );
}
