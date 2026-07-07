import useFeedback from "../hooks/useFeedback";
import { card, mutedNote, chip } from "../ui/styles";

// A simple "what you like" rollup from feedback signals (Phase 6a). Read-only —
// it doesn't steer generation yet; that's 6d. It's the seed of the emergent
// "Your Sound".
export default function TasteSummary() {
  const { summary } = useFeedback();
  if (summary.total === 0) return null;

  const tags = [...summary.topMoods, ...summary.topKeys];

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>What you're leaning toward</span>
      {tags.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tags.map((t) => (
            <span key={t.label} style={{ ...chip, textTransform: "capitalize" }}>{t.label}</span>
          ))}
        </div>
      ) : (
        <span style={mutedNote}>Still learning how you react — like a few tracks to shape this.</span>
      )}
      <span style={{ ...mutedNote, fontSize: 11.5 }}>
        {summary.liked} liked · {summary.total} signal{summary.total === 1 ? "" : "s"} so far. This will grow into your own sound.
      </span>
    </div>
  );
}
