import { useState } from "react";
import { startAudio, stopAudio } from "../audio/toneEngine";
import { generateComposition, fallbackComposition } from "../ai/composer";
import { startCompositionRuntime, startRuntimeLoop, stopRuntimeLoop } from "../audio/compositionRuntime";
import { postToast } from "../utils/toast";
import { db } from "../db/db";
import { analyzeSession } from "../memory/analyzeSession";
import type { CompositionPlan } from "../ai/types";
import type { StimulusEvent } from "../types";

export default function useAudioComposer(events: StimulusEvent[], modelLoaded: boolean) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiStatus, setAIStatus] = useState("Ready");
  const [status, setStatus] = useState("Ready");
  const [plan, setPlan] = useState<CompositionPlan | null>(null);
  const [currentSessionSaved, setCurrentSessionSaved] = useState(false);

  async function saveSession(events: StimulusEvent[], plan: CompositionPlan) {
    try {
      const summary = analyzeSession(crypto.randomUUID(), events, plan);
      summary.plan = plan;
      await db.sessions.add(summary);
      setCurrentSessionSaved(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("session-saved"));
      }
    } catch (error) {
      console.error("Failed to save session summary", error);
    }
  }

  async function endSession(events: StimulusEvent[], plan: CompositionPlan | null) {
    if (!plan || currentSessionSaved) {
      return;
    }

    await saveSession(events, plan);
  }

  async function handlePlayToggle() {
    if (isPlaying) {
      stopAudio();
      stopRuntimeLoop();
      await endSession(events, plan);
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
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Audio failed: ${message}`, "error");
      setStatus("Audio failed");
    }
  }

  async function runAIComposer() {
    if (!modelLoaded) {
      postToast("Model not loaded. Load the model before generating.", "warning");
      setStatus("Model not loaded. Load the model before generating.");
      return;
    }

    setAIStatus("Generating composition...");
    setStatus("Generating composition...");

    try {
      const composition = await generateComposition(events);
      setPlan(composition);
      await saveSession(events, composition);
      startCompositionRuntime(composition);
      startRuntimeLoop();
      setStatus(`Composition generated: ${composition.key}`);
    } catch (error) {
      console.error("Failed to generate composition", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`AI composition failed: ${message}`, "error");
      setStatus(`AI composition failed: ${message}`);
      const fallback = fallbackComposition();
      setPlan(fallback);
      startCompositionRuntime(fallback);
      startRuntimeLoop();
    } finally {
      setAIStatus("Ready");
    }
  }

  async function loadSessionPlan(planInput: CompositionPlan) {
    setPlan(planInput);
    setCurrentSessionSaved(true);

    try {
      await startAudio();
      setIsPlaying(true);
      setStatus("Session loaded and playing");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Audio failed: ${message}`, "error");
      setStatus("Audio failed");
      return;
    }

    startCompositionRuntime(planInput);
    startRuntimeLoop();
  }

  return {
    isPlaying,
    aiStatus,
    status,
    plan,
    handlePlayToggle,
    runAIComposer,
    loadSessionPlan,
  };
}
