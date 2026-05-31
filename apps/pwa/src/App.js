import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { startAudio } from "./audio/toneEngine";
import { db } from "./db/db";
import { useAppStore } from "./store/useAppStore";
export default function App() {
    const { events, setEvents, addEvent } = useAppStore();
    const [status, setStatus] = useState("Ready");
    useEffect(() => {
        db.events
            .orderBy("timestamp")
            .reverse()
            .toArray()
            .then(setEvents)
            .catch((err) => {
            console.error("Failed to load events", err);
        });
    }, [setEvents]);
    async function handlePlay() {
        try {
            await startAudio();
            setStatus("Audio started");
        }
        catch (error) {
            console.error(error);
            setStatus("Audio failed");
        }
    }
    async function addMood(label) {
        const event = {
            id: nanoid(),
            timestamp: Date.now(),
            source: "manual",
            label,
        };
        try {
            await db.events.add(event);
            addEvent(event);
        }
        catch (error) {
            console.error("Failed to save mood event", error);
            setStatus("Save failed");
        }
    }
    return (<div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <h1>Ambient FM</h1>
      <p style={{ margin: "0 0 16px" }}>Tap play once, then log a mood and refresh.</p>

      <button type="button" onClick={handlePlay} style={{ fontSize: 16, padding: "12px 18px", marginBottom: 16 }}>
        Play Test Tone
      </button>

      <div style={{ marginBottom: 24 }}>
        <strong>Status:</strong> {status}
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2>Log Mood</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Focused" },
            { label: "Calm" },
            { label: "Tired" },
        ].map((item) => (<button key={item.label} type="button" onClick={() => addMood(item.label)} style={{ padding: "12px 16px", minWidth: 96 }}>
              {item.label}
            </button>))}
        </div>
      </section>

      <section>
        <h2>Timeline</h2>
        {events.length === 0 ? (<p>No mood events yet.</p>) : (<div style={{ display: "grid", gap: 12 }}>
            {events.map((event) => (<div key={event.id} style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fafafa",
                }}>
                <div style={{ fontWeight: 700 }}>{event.label}</div>
                <div style={{ fontSize: 13, color: "#555" }}>
                  {new Date(event.timestamp).toLocaleString()}
                </div>
              </div>))}
          </div>)}
      </section>
    </div>);
}
