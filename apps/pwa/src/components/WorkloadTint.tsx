import { useSession } from "../session/SessionProvider";

// A subtle, ambient indicator of how hard the app is working (≈ how much battery
// it's drawing right now): a faint accent glow from the top that grows with the
// runtime workload. Idle → invisible; playing → faint; generating/loading →
// strongest. Purely decorative (pointer-events: none), sits above content at very
// low opacity so it never hurts readability.
export default function WorkloadTint() {
  const { radio, model, isGenerating } = useSession();

  const loading = model.modelProgress != null && model.modelProgress < 1;
  const level =
    loading ? 1
    : isGenerating || radio.state === "generating" ? 0.85
    : radio.state === "announcing" ? 0.45
    : radio.state === "playing" ? 0.28
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
          "radial-gradient(135% 90% at 50% 0%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 62%)",
        opacity: level,
        transition: "opacity 1.1s ease",
      }}
    />
  );
}
