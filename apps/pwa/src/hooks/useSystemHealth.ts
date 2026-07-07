import { useEffect, useState } from "react";
import * as Tone from "tone";
import { db } from "../db/db";
import { isModelLoaded, isModelDownloaded, getSelectedModelLabel } from "../ai/composer";
import { voiceInstalled, voiceReady } from "../audio/hostPiper";

export type SystemHealth = {
  gpu: boolean;
  cores: number | null;
  memoryGB: number | null;
  online: boolean;
  standalone: boolean;
  audioState: string;
  storageUsedMB: number | null;
  storageQuotaMB: number | null;
  modelLabel: string;
  modelLoaded: boolean;
  modelDownloaded: boolean;
  voiceInstalled: boolean;
  voiceReady: boolean;
  counts: { sounds: number; tracks: number; captures: number; feedback: number };
};

// Snapshot of app + device health for the Settings diagnostics.
export default function useSystemHealth(): SystemHealth | null {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nav = navigator as unknown as { gpu?: unknown; hardwareConcurrency?: number; deviceMemory?: number };
      let storageUsedMB: number | null = null;
      let storageQuotaMB: number | null = null;
      try {
        const est = await navigator.storage?.estimate?.();
        if (est) { storageUsedMB = Math.round((est.usage ?? 0) / 1e6); storageQuotaMB = Math.round((est.quota ?? 0) / 1e6); }
      } catch { /* ignore */ }
      const [sounds, tracks, captures, feedback] = await Promise.all([
        db.sounds.count().catch(() => 0),
        db.sessions.count().catch(() => 0),
        db.recordings.count().catch(() => 0),
        db.feedback.count().catch(() => 0),
      ]);
      let modelDownloaded = false;
      try { modelDownloaded = await isModelDownloaded(); } catch { /* ignore */ }
      let audioState = "—";
      try { audioState = (Tone.getContext().rawContext as unknown as { state?: string }).state ?? "—"; } catch { /* ignore */ }
      if (cancelled) return;
      setHealth({
        gpu: !!nav.gpu,
        cores: nav.hardwareConcurrency ?? null,
        memoryGB: nav.deviceMemory ?? null,
        online: navigator.onLine,
        standalone: window.matchMedia?.("(display-mode: standalone)")?.matches ?? false,
        audioState,
        storageUsedMB,
        storageQuotaMB,
        modelLabel: getSelectedModelLabel?.() ?? "—",
        modelLoaded: isModelLoaded(),
        modelDownloaded,
        voiceInstalled: voiceInstalled(),
        voiceReady: voiceReady(),
        counts: { sounds, tracks, captures, feedback },
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return health;
}
