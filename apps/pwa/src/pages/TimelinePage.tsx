import { useEffect, useState } from "react";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import { postToast } from "../utils/toast";
import type { StimulusEvent } from "../types";

export default function TimelinePage() {
  const { setEvents } = useAppStore();
  const [events, setLocalEvents] = useState<StimulusEvent[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  async function loadTimelineEvents() {
    try {
      const loaded = await db.events.orderBy("timestamp").reverse().toArray();
      setLocalEvents(loaded);
      setEvents(loaded);
    } catch (error) {
      console.error("Failed to load timeline events", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Failed to load timeline events: ${message}`, "error");
    }
  }

  async function deleteEvent(id: string) {
    if (!window.confirm("Delete this event?")) {
      return;
    }

    setIsDeleting(id);
    try {
      await db.events.delete(id);
      const updated = events.filter((event) => event.id !== id);
      setLocalEvents(updated);
      setEvents(updated);
      postToast("Event deleted.", "success");
    } catch (error) {
      console.error("Failed to delete event", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Delete failed: ${message}`, "error");
    } finally {
      setIsDeleting(null);
    }
  }

  useEffect(() => {
    loadTimelineEvents();
  }, []);

  return (
    <section style={{ marginTop: 24 }}>
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
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{event.label}</div>
                <button
                  type="button"
                  onClick={() => deleteEvent(event.id)}
                  disabled={isDeleting === event.id}
                  style={{ fontSize: 12, padding: "6px 10px" }}
                >
                  {isDeleting === event.id ? "Deleting…" : "Delete"}
                </button>
              </div>
              <div style={{ fontSize: 13, color: "#555" }}>
                {new Date(event.timestamp).toLocaleString()}
              </div>
              <div style={{ fontSize: 13 }}>
                Source: {event.source}
                {typeof event.value === "number" ? ` · Value: ${event.value}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
