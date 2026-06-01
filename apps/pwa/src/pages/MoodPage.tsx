import "./MoodPage.css";
import StimulusMixer from "../components/StimulusMixer";
import useMoodPage from "../hooks/useMoodPage";
import ComposerControls from "../features/composer/ComposerControls";

export default function MoodPage() {
  const {
    allMoodPresets,
    configs,
    customMoodButtonVisible,
    customMoodName,
    deleteEvent,
    events,
    handleMoodValueChange,
    handleToggleEnabled,
    handleUpdateWeight,
    applyMoodPreset,
    isDeleting,
    isReady,
    isSavingCustomMood,
    moodValues,
    saveCustomMood,
    saveMoodEvent,
    setCustomMoodName,
  } = useMoodPage();

  return (
    <div className="mood-page">
      <h1>Mood Controls</h1>
      <p className="mood-page__subtitle">
        Adjust the influence of each stimulus channel and apply a mood preset to shift the entire input space.
      </p>

      <section className="mood-page__grid">
        <div>
          <div className="mood-page__preset-list">
            {allMoodPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="mood-page__button"
                onClick={() => void applyMoodPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {customMoodButtonVisible ? (
            <div className="mood-page__actions">
              <input
                type="text"
                className="mood-page__text-input"
                value={customMoodName}
                onChange={(event) => setCustomMoodName(event.target.value)}
                placeholder="Custom mood name"
              />
              <button
                type="button"
                className="mood-page__button"
                disabled={!customMoodName.trim() || isSavingCustomMood}
                onClick={() => void saveCustomMood()}
              >
                {isSavingCustomMood ? "Saving..." : "Save mood"}
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <div className="mood-page__strength-grid">
            {(["energy", "calmness", "tension", "brightness"] as const).map((key) => (
              <div key={key} className="mood-page__range-row">
                <div className="mood-page__range-heading">
                  <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  <span>{Math.round(moodValues[key] * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={moodValues[key]}
                  onChange={(event) => void handleMoodValueChange(key, Number(event.target.value))}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          {isReady ? (
            <StimulusMixer configs={configs} onToggleEnabled={handleToggleEnabled} onUpdateWeight={handleUpdateWeight} />
          ) : (
            <p className="mood-page__status-note">Loading mood controls…</p>
          )}
        </div>
      </section>

      <ComposerControls />

      <section>
        <div className="mood-page__actions mood-page__actions--centered">
          <button
            type="button"
            className="mood-page__button"
            disabled={!isReady}
            onClick={() => void saveMoodEvent()}
          >
            Save Mood
          </button>
        </div>
        <h2 className="mood-page__panel-title">Recent Mood Timeline</h2>
        {events.length === 0 ? (
          <p className="mood-page__status-note">No mood events yet.</p>
        ) : (
          <div className="mood-page__timeline">
            {events.map((event) => (
              <div key={event.id} className="mood-page__event-card">
                <div className="mood-page__event-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{event.label}</div>
                    <div className="mood-page__event-meta">{event.source}</div>
                  </div>
                  <button
                    type="button"
                    className="mood-page__button"
                    onClick={() => deleteEvent(event.id)}
                    disabled={isDeleting === event.id}
                  >
                    {isDeleting === event.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
                <div className="mood-page__event-meta">{new Date(event.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
