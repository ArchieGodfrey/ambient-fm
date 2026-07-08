import { useStation, STATION_VOICES, type StationVoice, type StationConfig } from "../config/station";
import { resetVoiceSession } from "../audio/hostPiper";

// Choose the host's voice. Selecting only sets the config (+ auto-fills the host
// name from the voice, unless the user set a custom one); the "Voice host" section
// downloads + previews the selected voice.
export default function VoicePicker() {
  const { station, update } = useStation();

  const select = (v: StationVoice) => {
    if (v.id === station.voiceId) return;
    const patch: Partial<StationConfig> = { voiceId: v.id };
    // Keep the host name in sync with the voice while it's still a default (empty
    // or matching a known voice name); don't clobber a name the user typed.
    if (!station.hostName.trim() || STATION_VOICES.some((x) => x.name === station.hostName)) patch.hostName = v.name;
    update(patch);
    resetVoiceSession(); // next download/preview uses the newly-selected voice
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
      {STATION_VOICES.map((v) => {
        const active = v.id === station.voiceId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => select(v)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
              padding: "9px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
              border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
              background: active ? "var(--accent-soft)" : "var(--bg)",
              color: active ? "var(--accent)" : "var(--text-h)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>{v.name}</span>
            <span style={{ fontSize: 11.5, opacity: 0.7 }}>{v.accent} · {v.gender}</span>
          </button>
        );
      })}
    </div>
  );
}
