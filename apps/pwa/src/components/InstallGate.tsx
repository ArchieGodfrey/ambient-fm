import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Share, Plus, Download, ArrowRight } from "lucide-react";
import { getPlatform, canPromptInstall, onInstallAvailabilityChange, promptInstall, setOnboarded } from "../utils/install";
import { primaryButton, ghostButton, mutedNote } from "../ui/styles";

// The install "soft wall": a full-screen screen shown when the app is running in
// a browser tab (not installed). The user can install (illustrated on iOS, a
// one-tap prompt on Android/Chromium) or dismiss to continue in the browser.
export default function InstallGate({ onContinue }: { onContinue: () => void }) {
  const platform = getPlatform();
  const [installable, setInstallable] = useState(canPromptInstall());

  useEffect(() => onInstallAvailabilityChange(() => setInstallable(canPromptInstall())), []);

  const dismiss = () => { setOnboarded(true); onContinue(); };

  const install = async () => {
    const ok = await promptInstall();
    if (ok) { setOnboarded(true); onContinue(); }
  };

  return (
    <div style={overlay}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, maxWidth: 420, width: "100%" }}>
        <Disc />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-h)", margin: "6px 0 0" }}>Install Ambient FM</h1>
        <p style={{ ...mutedNote, textAlign: "center", maxWidth: 340 }}>
          Add it to your home screen for the full experience — offline listening and music that keeps
          playing when your screen is locked.
        </p>

        <div style={{ ...panel, marginTop: 14 }}>
          {platform === "ios" ? (
            <ol style={steps}>
              <Step n={1}>Tap the <b>Share</b> button <Share size={15} /> in the Safari toolbar.</Step>
              <Step n={2}>Choose <b>Add to Home Screen</b> <Plus size={15} />.</Step>
              <Step n={3}>Open <b>Ambient FM</b> from your home screen.</Step>
            </ol>
          ) : installable ? (
            <button type="button" onClick={install} style={{ ...primaryButton, width: "100%", justifyContent: "center" }}>
              <Download size={16} /> Install app
            </button>
          ) : (
            <p style={{ ...mutedNote, textAlign: "center" }}>
              Open your browser menu and choose <b>Install app</b> / <b>Add to Home Screen</b>.
            </p>
          )}
        </div>

        <button type="button" onClick={dismiss} style={{ ...ghostButton, marginTop: 14 }}>
          Continue in browser <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={stepNum}>{n}</span>
      <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>{children}</span>
    </li>
  );
}

// A small iridescent disc echoing the app icon.
function Disc() {
  return (
    <svg width="76" height="76" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id="ig-disc" cx="42%" cy="38%" r="70%">
          <stop offset="0" stop-color="#8f86e0" />
          <stop offset="0.55" stop-color="#6b62c9" />
          <stop offset="1" stop-color="#3a3568" />
        </radialGradient>
        <linearGradient id="ig-sheen" x1="0.1" y1="0.1" x2="0.9" y2="0.9">
          <stop offset="0" stop-color="#b9a6f4" /><stop offset="0.5" stop-color="#83e2dd" /><stop offset="1" stop-color="#f2a9d6" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#ig-disc)" />
      <circle cx="50" cy="50" r="46" fill="url(#ig-sheen)" opacity="0.4" />
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
const steps: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 };
const stepNum: CSSProperties = {
  flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--accent-soft)",
  color: "var(--accent)", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center",
};
