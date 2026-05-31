import { useState } from "react";
import type { CompositionPlan } from "../ai/types";
import type { StimulusEvent } from "../types";

type CompositionPlanSummaryProps = {
  events: StimulusEvent[];
  lastTime?: StimulusEvent;
  lastWeather?: StimulusEvent;
  plan: CompositionPlan | null;
  runtimeCursor?: number;
  activeSection?: CompositionPlan["sections"][number] | null;
  currentPhraseRole?: string | null;
  sectionTimeRemaining?: number;
};

export default function CompositionPlanSummary({ events, lastTime, lastWeather, plan, runtimeCursor, activeSection, currentPhraseRole, sectionTimeRemaining }: CompositionPlanSummaryProps) {
  const [showRawJson, setShowRawJson] = useState(false);

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
            <div>
              <button
                type="button"
                onClick={() => setShowRawJson((value) => !value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: "white",
                  cursor: "pointer",
                  alignSelf: "start",
                }}
              >
                {showRawJson ? "Show summary" : "Show raw JSON"}
              </button>
            </div>
            {showRawJson ? (
              <pre style={{ marginTop: 12, padding: 12, background: "#111", color: "#f7f7f7", borderRadius: 12, overflowX: "auto" }}>
                {JSON.stringify(plan, null, 2)}
              </pre>
            ) : (
              <>
                <div><strong>Key:</strong> {plan.key}</div>
                <div><strong>BPM:</strong> {plan.bpm}</div>
                <div><strong>Duration:</strong> {plan.duration}s</div>
                <div><strong>Global Mood:</strong> {plan.globalMood}</div>
                <div><strong>Current cursor:</strong> {runtimeCursor?.toFixed(1) ?? "0.0"}s</div>
                <div><strong>Active section:</strong> {activeSection?.mood ?? "None"}</div>
                <div><strong>Current phrase:</strong> {currentPhraseRole ?? "None"}</div>
                <div><strong>Section time remaining:</strong> {sectionTimeRemaining?.toFixed(1) ?? "0.0"}s</div>
                <div><strong>Texture:</strong> density {plan.texture.density}, brightness {plan.texture.brightness}, reverb {plan.texture.reverbAmount}</div>
                <div>
                  <strong>Layers:</strong> drone {plan.layers.drone}, pad {plan.layers.pad}, texture {plan.layers.texture}, pulse {plan.layers.pulse}
                </div>
                <div>
                  <strong>Motifs ({plan.motifs?.length ?? 0}):</strong>
                  <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                    {plan.motifs && plan.motifs.length > 0 ? (
                      plan.motifs.map((motif) => (
                        <li key={motif.id} style={{ marginBottom: 4 }}>
                          <strong>{motif.layer} motif:</strong> {motif.notes.join(" → ")} ({motif.rhythm.join(", ")})
                        </li>
                      ))
                    ) : (
                      <li style={{ marginBottom: 4 }}>No motifs generated yet.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <strong>Phrases ({plan.phrases?.length ?? 0}):</strong>
                  <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                    {plan.phrases && plan.phrases.length > 0 ? (
                      plan.phrases.map((phrase) => (
                        <li key={phrase.id} style={{ marginBottom: 4 }}>
                          <strong>{phrase.role} phrase:</strong> {phrase.motifs.join(" → ")} (variation {phrase.variation.toFixed(2)})
                        </li>
                      ))
                    ) : (
                      <li style={{ marginBottom: 4 }}>No phrases generated yet.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <strong>Sections ({plan.sections.length}):</strong>
                  <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                    {(() => {
                      const activeSectionIndex = plan.sections.findIndex((section) =>
                        runtimeCursor !== undefined && runtimeCursor >= section.start && runtimeCursor < section.start + section.duration,
                      );

                      return plan.sections.map((section, index) => {
                        const isActive = index === activeSectionIndex;
                        return (
                          <li
                            key={index}
                            style={{
                              marginBottom: 4,
                              padding: isActive ? "4px 8px" : "0",
                              borderRadius: 8,
                              background: isActive ? "rgba(55, 125, 255, 0.08)" : "transparent",
                              fontWeight: isActive ? 700 : 400,
                            }}
                          >
                            {section.mood} ({section.start}–{section.start + section.duration}s) intensity {section.intensity}
                          </li>
                        );
                      });
                    })()}
                  </ul>
                </div>
              </>
            )}
          </div>
        ) : (
          <p>No AI composition generated yet.</p>
        )}
      </div>
    </section>
  );
}
