import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db/db";
import { useAppStore } from "../store/useAppStore";
import type { Recording, RecordingFeatures } from "../capture/types";
import type { StimulusEvent } from "../types";

const CHANGED = "recordings-changed";

// Decode a recorded blob and extract cheap time-domain features: RMS (energy)
// and zero-crossing rate (a rough brightness proxy). No FFT needed.
async function analyze(blob: Blob): Promise<{ features: RecordingFeatures; durationMs: number }> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    let sumSq = 0;
    let zc = 0;
    for (let i = 0; i < data.length; i++) {
      sumSq += data[i] * data[i];
      if (i > 0 && (data[i - 1] < 0) !== (data[i] < 0)) zc++;
    }
    const n = Math.max(1, data.length);
    const rms = Math.sqrt(sumSq / n);
    const zcr = zc / n;
    return { features: { energy: Math.min(1, rms * 4), brightness: Math.min(1, zcr * 80), rms, zcr }, durationMs: buf.duration * 1000 };
  } finally {
    void ctx.close();
  }
}

export default function useCapture() {
  const [recording, setRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const addEvent = useAppStore((s) => s.addEvent);

  const load = useCallback(async () => {
    try {
      setRecordings(await db.recordings.orderBy("ts").reverse().toArray());
    } catch (e) {
      // Guard against an unopened/stale DB so this never throws uncaught.
      console.warn("Failed to load recordings", e);
    }
  }, []);

  useEffect(() => {
    void load();
    const h = () => void load();
    window.addEventListener(CHANGED, h);
    return () => window.removeEventListener(CHANGED, h);
  }, [load]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        try {
          const { features, durationMs } = await analyze(blob);
          const rec: Recording = { id: crypto.randomUUID(), ts: Date.now(), blob, durationMs, features, label: new Date().toLocaleString() };
          await db.recordings.add(rec);
          // Feed the moment to the AI as an "audio" stimulus (burns read db.events).
          const ev: StimulusEvent = { id: crypto.randomUUID(), source: "audio", label: "Captured moment", timestamp: Date.now(), strength: features.energy, metadata: { brightness: features.brightness } };
          await db.events.add(ev);
          addEvent(ev);
          window.dispatchEvent(new CustomEvent(CHANGED));
        } catch {
          setError("Couldn't process that recording.");
        }
      };
      mr.start();
      mrRef.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone access was blocked.");
    }
  }, [addEvent]);

  const stop = useCallback(() => {
    mrRef.current?.stop();
    mrRef.current = null;
    setRecording(false);
  }, []);

  const remove = useCallback(async (id: string) => {
    await db.recordings.delete(id);
    window.dispatchEvent(new CustomEvent(CHANGED));
  }, []);

  return { recording, recordings, error, start, stop, remove };
}
