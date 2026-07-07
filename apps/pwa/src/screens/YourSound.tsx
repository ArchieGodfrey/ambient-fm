import { useState } from "react";
import { Plus } from "lucide-react";
import useSounds from "../hooks/useSounds";
import Disc from "../components/Disc";
import YourSoundCard from "../components/YourSoundCard";
import Studio from "./Studio";
import { describeMood } from "../sounds/previewPlan";
import { DEFAULT_MOOD, DEFAULT_COMPOSER_SETTINGS, type Sound } from "../sounds/types";
import { screen, screenEyebrow, screenTitle, mutedNote } from "../ui/styles";

export default function YourSound() {
  const { sounds, createSound, updateSound, deleteSound } = useSounds();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = sounds.find((s) => s.id === openId) ?? null;

  async function handleNew() {
    const s = await createSound("New sound", DEFAULT_MOOD, DEFAULT_COMPOSER_SETTINGS);
    setOpenId(s.id);
  }

  return (
    <>
      <div style={screen} className="afm-rise">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={screenEyebrow}>Your sound</span>
          <h1 style={screenTitle}>Your sounds</h1>
          <p style={mutedNote}>Sounds are inspiration — shape one in the studio, let the AI elevate it, then burn it to a track. The radio draws on them too.</p>
        </div>

        <YourSoundCard />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 18 }}>
          {sounds.map((s: Sound) => (
            <button key={s.id} type="button" onClick={() => setOpenId(s.id)}
              style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 0 }}>
              <Disc size={104} mood={describeMood(s.mood)} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)", textAlign: "center" }}>{s.name}</span>
            </button>
          ))}
          <button type="button" onClick={() => void handleNew()}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 104, borderRadius: "var(--radius)", border: "1px dashed var(--border)", background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer" }}>
            <Plus size={22} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>New sound</span>
          </button>
        </div>
      </div>

      {open ? (
        <Studio sound={open} onClose={() => setOpenId(null)} onSave={(patch) => updateSound(open.id, patch)} onDelete={() => void deleteSound(open.id)} />
      ) : null}
    </>
  );
}
