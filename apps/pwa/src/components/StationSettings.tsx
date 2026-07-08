import { useStation } from "../config/station";
import { card, mutedNote } from "../ui/styles";

// Edit the station identity + host (name, personality). The voice picker is a
// separate control (VoicePicker) so it can be reused in the setup wizard too.
export default function StationSettings() {
  const { station, update } = useStation();

  const field: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-h)",
    fontSize: 14, fontFamily: "inherit",
  };
  const labelText: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "var(--text-h)" };

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelText}>Station name</span>
        <input
          style={field}
          value={station.stationName}
          maxLength={40}
          placeholder="Ambient FM"
          onChange={(e) => update({ stationName: e.target.value })}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelText}>Host name</span>
        <input
          style={field}
          value={station.hostName}
          maxLength={24}
          placeholder="your host"
          onChange={(e) => update({ hostName: e.target.value })}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelText}>Host personality</span>
        <textarea
          style={{ ...field, minHeight: 72, resize: "vertical" }}
          value={station.hostPersonality}
          maxLength={280}
          placeholder="e.g. warm and unhurried, a little playful — like late-night radio"
          onChange={(e) => update({ hostPersonality: e.target.value })}
        />
        <span style={mutedNote}>Shapes how the host talks between tracks.</span>
      </label>
    </div>
  );
}
