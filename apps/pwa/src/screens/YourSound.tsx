import useMoodPage from "../hooks/useMoodPage";
import StimulusMixer from "../components/StimulusMixer";
import ComposerControls from "../features/composer/ComposerControls";
import { screen, screenEyebrow, screenTitle, card, sectionLabel, chip, primaryButton, ghostButton, mutedNote } from "../ui/styles";

const MOOD_DIMS = [
  { key: "energy", label: "Energy" },
  { key: "calmness", label: "Calm" },
  { key: "tension", label: "Tension" },
  { key: "brightness", label: "Brightness" },
] as const;

export default function YourSound() {
  const {
    allMoodPresets, configs, customMoodButtonVisible, customMoodName,
    handleMoodValueChange, handleToggleEnabled, handleUpdateWeight, applyMoodPreset,
    isReady, isSavingCustomMood, moodValues, saveCustomMood, saveMoodEvent, setCustomMoodName,
  } = useMoodPage();

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Your sound</span>
        <h1 style={screenTitle}>Shape the mood</h1>
        <p style={mutedNote}>Tune how it feels, then save it as a sound you can return to and remix.</p>
      </div>

      {/* Presets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {allMoodPresets.map((preset) => (
          <button key={preset.label} type="button" style={chip} onClick={() => void applyMoodPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>

      {/* Mood dimensions */}
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 18 }}>
        {MOOD_DIMS.map(({ key, label }) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-h)", fontWeight: 500 }}>{label}</span>
              <span style={{ color: "var(--text-muted)" }}>{Math.round(moodValues[key] * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01} value={moodValues[key]}
              onChange={(e) => void handleMoodValueChange(key, Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </label>
        ))}
      </div>

      {/* Save this sound */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={primaryButton} disabled={!isReady} onClick={() => void saveMoodEvent()}>
          Save this mood
        </button>
        {customMoodButtonVisible ? (
          <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 200 }}>
            <input
              type="text" value={customMoodName} placeholder="Name this sound"
              onChange={(e) => setCustomMoodName(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
            />
            <button type="button" style={ghostButton} disabled={!customMoodName.trim() || isSavingCustomMood} onClick={() => void saveCustomMood()}>
              {isSavingCustomMood ? "Saving…" : "Save"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Sonic character */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Sonic character</span>
        <div style={card}><ComposerControls /></div>
      </div>

      {/* Influences */}
      {isReady ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={sectionLabel}>What colours your sound</span>
          <div style={card}>
            <StimulusMixer configs={configs} onToggleEnabled={handleToggleEnabled} onUpdateWeight={handleUpdateWeight} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
