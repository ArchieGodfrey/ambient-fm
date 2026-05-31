import type { CompositionPlan } from "../ai/types";
import type { StimulusEvent } from "../types";

type CompositionPlanSummaryProps = {
  events: StimulusEvent[];
  lastTime?: StimulusEvent;
  lastWeather?: StimulusEvent;
  plan: CompositionPlan | null;
};

export default function CompositionPlanSummary({ events, lastTime, lastWeather, plan }: CompositionPlanSummaryProps) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2>AI Composition Output</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        <div>Stimulus Count: {events.length}</div>
        <div>Last Time Stimulus: {lastTime?.label ?? "None"}</div>
        <div>Last Weather Stimulus: {lastWeather?.label ?? "None"}</div>
      </div>
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "#f7f7f7" }}>
        <h3>Composition Plan</h3>
        {plan ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div><strong>Key:</strong> {plan.key}</div>
            <div><strong>BPM:</strong> {plan.bpm}</div>
            <div><strong>Global Mood:</strong> {plan.globalMood}</div>
            <div><strong>Texture:</strong> density {plan.texture.density}, brightness {plan.texture.brightness}, reverb {plan.texture.reverbAmount}</div>
            <div>
              <strong>Layers:</strong> drone {plan.layers.drone}, pad {plan.layers.pad}, texture {plan.layers.texture}, pulse {plan.layers.pulse}
            </div>
            <div>
              <strong>Sections:</strong>
              <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                {plan.sections.map((section, index) => (
                  <li key={index} style={{ marginBottom: 4 }}>
                    {section.mood} ({section.start}–{section.start + section.duration}s) intensity {section.intensity}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p>No AI composition generated yet.</p>
        )}
      </div>
    </section>
  );
}
