import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { startAudio, stopAudio, updateAudio } from "./audio/toneEngine";
import { deriveAudioState } from "./audio/deriveAudioState";
import { applyComposition } from "./audio/applyComposition";
import { generateComposition } from "./ai/composer";
import { buildStimulusSnapshot } from "./stimuli/buildStimulusSnapshot";
import { db } from "./db/db";
import { useAppStore } from "./store/useAppStore";
import type { CompositionPlan } from "./ai/types";
import type { StimulusEvent } from "./types";

export default function App() {
  const { events, setEvents, addEvent } = useAppStore();
  const [status, setStatus] = useState("Ready");
  const [aiStatus, setAIStatus] = useState("Ready");
  const [audioState, setAudioState] = useState({
    bpm: 90,
    filterCutoff: 800,
    reverbMix: 0.4,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [plan, setPlan] = useState<CompositionPlan | null>(null);

  async function loadEvents() {
    try {
      const loaded = await db.events.orderBy("timestamp").reverse().toArray();
      setEvents(loaded);
      if (!loaded.some((event) => event.source === "time")) {
        await refreshStimuli();
      }
    } catch (error) {
      console.error("Failed to load events", error);
      setStatus("Load failed");
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (plan) return;
    const state = deriveAudioState(events);
    setAudioState(state);
    updateAudio(state);
  }, [events, plan]);

  async function handlePlayToggle() {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
      setStatus("Audio stopped");
      return;
    }

    try {
      await startAudio();
      setIsPlaying(true);
      setStatus("Audio started");
    } catch (error) {
      console.error(error);
      setStatus("Audio failed");
    }
  }

  async function runAIComposer() {
    setAIStatus("Generating composition...");
    try {
      const composition = await generateComposition(events);
      setPlan(composition);
      applyComposition(composition);
      setAudioState({
        bpm: composition.bpm,
        filterCutoff: 400 + composition.texture.brightness * 2000,
        reverbMix: composition.texture.reverbAmount,
      });
      setStatus(`Composition generated: ${composition.key}`);
    } catch (error) {
      console.error("Failed to generate composition", error);
      setStatus("AI composition failed");
    } finally {
      setAIStatus("Ready");
    }
  }

  async function addMood(label: string) {
    const event: StimulusEvent = {
      id: nanoid(),
      timestamp: Date.now(),
      source: "manual",
      label,
    };

    try {
      await db.events.add(event);
      addEvent(event);
      setStatus(`Added ${label}`);
    } catch (error) {
      console.error("Failed to save mood event", error);
      setStatus("Save failed");
    }
  }

  async function refreshStimuli() {
    setRefreshing(true);
    try {
      const snapshot = await buildStimulusSnapshot();
      for (const event of snapshot) {
        await db.events.add(event);
        addEvent(event);
      }
      setStatus("Environment refreshed");
    } catch (error) {
      console.error("Failed to refresh stimuli", error);
      setStatus("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const lastWeather = events.find((event) => event.source === "weather");
  const lastTime = events.find((event) => event.source === "time");

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <h1>Ambient FM</h1>
      <p style={{ margin: "0 0 16px" }}>
        Tap play once, then log mood or refresh the environment.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <button
          type="button"
          onClick={handlePlayToggle}
          style={{ fontSize: 16, padding: "12px 18px" }}
        >
          {isPlaying ? "Stop Test Tone" : "Play Test Tone"}
        </button>
        <button
          type="button"
          onClick={refreshStimuli}
          disabled={refreshing}
          style={{ fontSize: 16, padding: "12px 18px" }}
        >
          {refreshing ? "Refreshing..." : "Refresh Environment"}
        </button>
        <button
          type="button"
          onClick={runAIComposer}
          disabled={aiStatus !== "Ready"}
          style={{ fontSize: 16, padding: "12px 18px" }}
        >
          {aiStatus === "Ready" ? "Generate AI Composition" : "Generating..."}
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <strong>Status:</strong> {status}
        <div style={{ marginTop: 4, fontSize: 14, color: "#555" }}>AI: {aiStatus}</div>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2>Log Mood</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Focused" },
            { label: "Calm" },
            { label: "Tired" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => addMood(item.label)}
              style={{ padding: "12px 16px", minWidth: 96 }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>AI Composition Output</h2>
        <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
          <div>Stimulus Count: {events.length}</div>
          <div>BPM: {audioState.bpm.toFixed(0)}</div>
          <div>Filter Cutoff: {audioState.filterCutoff.toFixed(0)}</div>
          <div>Reverb Mix: {audioState.reverbMix.toFixed(2)}</div>
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

      <section>
        <h2>Timeline</h2>
        {events.length === 0 ? (
          <p>No events yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {events.map((event) => (
              <div
                key={event.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                }}
              >
                <div style={{ fontWeight: 700 }}>{event.label}</div>
                <div style={{ fontSize: 13, color: "#555" }}>
                  {new Date(event.timestamp).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  Source: {event.source}
                  {typeof event.value === "number" ? ` · Value: ${event.value}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
