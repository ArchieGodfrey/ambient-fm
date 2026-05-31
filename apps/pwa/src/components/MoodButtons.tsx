type MoodButtonsProps = {
  onAddMood: (label: string) => Promise<void> | void;
};

const moods = ["Focused", "Calm", "Tired"];

export default function MoodButtons({ onAddMood }: MoodButtonsProps) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Log Mood</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {moods.map((label) => (
          <button key={label} type="button" onClick={() => onAddMood(label)} style={{ padding: "12px 16px", minWidth: 96 }}>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
