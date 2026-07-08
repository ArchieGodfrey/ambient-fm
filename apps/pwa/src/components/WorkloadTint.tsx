import { useEffect, useRef, useState } from "react";
import { useSession } from "../session/SessionProvider";

// A subtle, ambient indicator of how hard the app is working (≈ how much battery
// it's drawing): an accent glow from the top that's strongest while the model is
// working (loading or composing), softer during plain playback, gone when idle.
// Purely decorative (pointer-events: none). Model activity is bursty, so we hold
// the "busy" state briefly after it clears so each burst is actually visible.
export default function WorkloadTint() {
  const { radio, model, isGenerating } = useSession();
  const [busy, setBusy] = useState(false);
  const clearRef = useRef<number | null>(null);

  // Any model activity sets modelProgress (load or per-track inference).
  const active = model.modelProgress != null || isGenerating || radio.state === "generating";
  useEffect(() => {
    if (active) {
      if (clearRef.current) { clearTimeout(clearRef.current); clearRef.current = null; }
      setBusy(true);
    } else if (busy && clearRef.current == null) {
      clearRef.current = window.setTimeout(() => { setBusy(false); clearRef.current = null; }, 1800);
    }
  }, [active, busy]);

  const opacity =
    busy ? 0.6
    : radio.state === "playing" || radio.state === "announcing" ? 0.22
    : 0;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
        background:
          "radial-gradient(150% 100% at 50% 0%, color-mix(in srgb, var(--accent) 34%, transparent), transparent 58%)",
        opacity,
        transition: "opacity 0.9s ease",
      }}
    />
  );
}
