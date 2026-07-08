import { useState, useRef, type CSSProperties } from "react";
import { Download, Check, Sparkles, ArrowRight, ArrowLeft, Loader } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import useVoiceManager from "../hooks/useVoiceManager";
import { setSetupDone, requestPersistentStorage } from "../utils/install";
import { downloadSamples } from "../audio/sampleLibrary";
import StationSettings from "./StationSettings";
import { primaryButton, ghostButton, mutedNote } from "../ui/styles";

type Step = "welcome" | "customize" | "downloading" | "done";

// First-run setup wizard: explains the app, then — only after the user explicitly
// accepts — downloads the on-device model + DJ voice, requests persistent storage
// so the caches survive, and marks setup complete. Re-runnable from Settings.
export default function SetupWizard({ onDone }: { onDone: () => void }) {
  const { model } = useSession();
  const voice = useVoiceManager();
  const [step, setStep] = useState<Step>("welcome");
  const [failed, setFailed] = useState(false);
  const [samplesProgress, setSamplesProgress] = useState<number | null>(null);
  const runRef = useRef(0); // bumped on cancel so a stale in-flight download can't resurface

  const finish = () => { setSetupDone(true); onDone(); };
  const skip = () => { setSetupDone(true); onDone(); };

  const accept = async () => {
    const rid = ++runRef.current;
    setStep("downloading");
    setFailed(false);
    setSamplesProgress(null);
    await requestPersistentStorage(); // ask before we store GBs, so they aren't eviction-eligible
    let okVoice = false, okModel = false, okSamples = false;
    try {
      // Voice first — small, reliable CPU download. Then the instrument samples
      // (a few MB, cached for offline). Then the model, which caches its weights
      // (a one-time load pass, then unloaded — not kept in RAM).
      okVoice = await voice.download();
      if (runRef.current !== rid) return; // cancelled mid-download
      okSamples = await downloadSamples((l, t) => setSamplesProgress(t ? l / t : 1));
      if (runRef.current !== rid) return;
      okModel = await model.downloadModelAction();
    } catch { /* reflected in the ok flags below */ }
    if (runRef.current !== rid) return;   // cancelled → don't overwrite the reset UI
    setFailed(!(okVoice && okModel && okSamples));
    setStep("done");
  };

  // Cancel an in-flight download and return to the start so the user is never
  // trapped (e.g. a model load that stalls). Tears down the runtime to abort it.
  const back = () => {
    runRef.current++;
    void model.resetRuntimeAction().catch(() => { /* best-effort abort */ });
    setStep("welcome");
  };

  return (
    <div style={overlay}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 440, width: "100%" }}>
        <Disc />

        {step === "welcome" && (
          <>
            <h1 style={title}>Welcome to Ambient FM</h1>
            <p style={{ ...mutedNote, textAlign: "center", maxWidth: 360 }}>
              A radio station that composes music for you, on your device. An in-browser AI writes each
              track and a neural voice hosts between them — all offline, nothing sent to a server.
            </p>
            <div style={{ ...panel, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Download size={18} style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-h)", fontSize: 14 }}>Prepare for offline</div>
                  <p style={{ ...mutedNote, marginTop: 3 }}>
                    We'll download the AI music model, the DJ voice, and the instrument samples now —
                    roughly <b>300–600&nbsp;MB</b>, once. After that the app works fully offline.
                  </p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setStep("customize")} style={{ ...primaryButton, width: "100%", justifyContent: "center", marginTop: 14 }}>
              <ArrowRight size={16} /> Get started
            </button>
            <button type="button" onClick={skip} style={ghostButton}>Skip for now</button>
          </>
        )}

        {step === "customize" && (
          <>
            <h1 style={title}>Make it yours</h1>
            <p style={{ ...mutedNote, textAlign: "center", maxWidth: 360 }}>
              Name your station and host, give the host a personality, and pick a voice. You can change
              any of this later in Settings.
            </p>
            <div style={{ width: "100%", marginTop: 12 }}>
              <StationSettings />
            </div>
            <button type="button" onClick={accept} style={{ ...primaryButton, width: "100%", justifyContent: "center", marginTop: 14 }}>
              <Download size={16} /> Download &amp; continue
            </button>
            <button type="button" onClick={() => setStep("welcome")} style={ghostButton}>
              <ArrowLeft size={15} /> Back
            </button>
          </>
        )}

        {step === "downloading" && (
          <>
            <h1 style={title}>Getting things ready…</h1>
            <p style={{ ...mutedNote, textAlign: "center" }}>Downloading to your device. This can take a few minutes on first run.</p>
            <div style={{ ...panel, marginTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
              <ProgressRow label="DJ voice" progress={voice.progress} text={voice.progressText} />
              <ProgressRow label="Instruments" progress={samplesProgress} text={null} />
              <ProgressRow label="Music model" progress={model.modelProgress} text={model.progressText} />
            </div>
            <button type="button" onClick={back} style={{ ...ghostButton, marginTop: 14 }}>
              <ArrowLeft size={15} /> Back
            </button>
            <span style={{ ...mutedNote, fontSize: 11.5, textAlign: "center", maxWidth: 340 }}>
              Taking too long? Go back and try again, or skip — it'll download automatically the first time you tune in.
            </span>
          </>
        )}

        {step === "done" && (
          <>
            <h1 style={title}>{failed ? "Almost there" : "You're all set"}</h1>
            <p style={{ ...mutedNote, textAlign: "center", maxWidth: 360 }}>
              {failed
                ? "Some assets didn't finish downloading — the app still works, and it'll retry automatically the first time you tune in. You can re-run setup any time from Settings."
                : "The model and voice are on your device and protected for offline use. Tune in and Ambient FM will start composing."}
            </p>
            <button type="button" onClick={finish} style={{ ...primaryButton, width: "100%", justifyContent: "center", marginTop: 16 }}>
              {failed ? <>Continue <ArrowRight size={15} /></> : <><Sparkles size={16} /> Start listening</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProgressRow({ label, progress, text }: { label: string; progress: number | null; text: string | null }) {
  const done = progress != null && progress >= 1;
  const pct = progress != null ? Math.round(progress * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>{label}</span>
        <span style={{ fontSize: 12, color: done ? "var(--accent)" : "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          {done ? <><Check size={13} /> Ready</> : progress != null ? `${pct}%` : <span className="afm-spin"><Loader size={13} /></span>}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--surface-muted)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", transition: "width 0.25s ease" }} />
      </div>
      {text ? <span style={{ ...mutedNote, fontSize: 11.5 }}>{text}</span> : null}
    </div>
  );
}

function Disc() {
  return (
    <svg width="72" height="72" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id="sw-disc" cx="42%" cy="38%" r="70%">
          <stop offset="0" stop-color="#8f86e0" /><stop offset="0.55" stop-color="#6b62c9" /><stop offset="1" stop-color="#3a3568" />
        </radialGradient>
        <linearGradient id="sw-sheen" x1="0.1" y1="0.1" x2="0.9" y2="0.9">
          <stop offset="0" stop-color="#b9a6f4" /><stop offset="0.5" stop-color="#83e2dd" /><stop offset="1" stop-color="#f2a9d6" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#sw-disc)" />
      <circle cx="50" cy="50" r="46" fill="url(#sw-sheen)" opacity="0.4" />
      <circle cx="50" cy="50" r="13" fill="var(--bg)" />
    </svg>
  );
}

const overlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 200,
  background: "linear-gradient(160deg, #2a2456 0%, var(--bg) 60%)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))",
  overflowY: "auto",
};
const panel: CSSProperties = {
  width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", padding: 20,
};
const title: CSSProperties = { fontSize: 24, fontWeight: 700, color: "var(--text-h)", margin: "6px 0 0", textAlign: "center" };
