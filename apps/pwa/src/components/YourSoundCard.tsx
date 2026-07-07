import { Play, GitBranch } from "lucide-react";
import usePreference from "../hooks/usePreference";
import useSounds from "../hooks/useSounds";
import { useSession } from "../session/SessionProvider";
import { buildSoundscape, describeMood } from "../sounds/previewPlan";
import { postToast } from "../utils/toast";
import Disc from "./Disc";
import { card, mutedNote, chip, ghostButton } from "../ui/styles";

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 64, fontSize: 11.5, color: "var(--text-muted)" }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface-muted)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

// The emergent, un-editable "Your Sound" (6c): formed from your preference +
// recent stimulus. You don't edit it — you branch an editable copy.
export default function YourSoundCard() {
  const { preference: p, describe, yourSound, drift } = usePreference();
  const { createFromSound } = useSounds();
  const { audio } = useSession();

  if (p.sampleSize === 0) {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
        <Disc size={64} mood="ambient" inserting={false} style={{ opacity: 0.5 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>Your Sound</span>
          <span style={mutedNote}>Forms as you play and react to tracks — like a few and it'll take shape here.</span>
        </div>
      </div>
    );
  }

  const tags = [...p.topMoods, ...p.topKeys].filter((t) => t.score > 0).slice(0, 5);

  async function branch() {
    await createFromSound(yourSound, "My sound");
    postToast("Branched your sound — edit it in the studio.", "success");
  }

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--accent-border)", background: "var(--accent-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Disc size={72} mood={describeMood(yourSound.mood)} inserting={false} style={{ outline: "2px solid var(--accent-border)", outlineOffset: 4, borderRadius: "50%" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-h)" }}>Your Sound</span>
          <span style={{ fontSize: 12.5, color: "var(--text)", textTransform: "capitalize" }}>{describe}</span>
          {drift ? <span style={{ fontSize: 12, color: "var(--accent)" }}>{drift}</span> : null}
        </div>
      </div>

      {tags.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tags.map((t) => <span key={t.label} style={{ ...chip, textTransform: "capitalize" }}>{t.label}</span>)}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Bar label="energy" value={p.energy} />
        <Bar label="intricacy" value={p.complexity} />
        <Bar label="minor" value={p.minorBias} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void audio.loadSessionPlan(buildSoundscape(yourSound), "Your Sound")} style={ghostButton}><Play size={15} /> Listen</button>
        <button type="button" onClick={() => void branch()} style={ghostButton}><GitBranch size={15} /> Branch to edit</button>
      </div>

      <span style={{ ...mutedNote, fontSize: 11.5 }}>
        Formed from {p.sampleSize} track{p.sampleSize === 1 ? "" : "s"} + recent moments · {Math.round(p.confidence * 100)}% confident. It evolves — you can't edit it directly.
      </span>
    </div>
  );
}
