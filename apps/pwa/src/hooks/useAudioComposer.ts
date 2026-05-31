import { useState } from "react";
import { startAudio, stopAudio } from "../audio/toneEngine";
import { generateComposition, fallbackComposition } from "../ai/composer";
import { startCompositionRuntime, startRuntimeLoop, stopRuntimeLoop } from "../audio/compositionRuntime";
import { postToast } from "../utils/toast";
import type { CompositionPlan } from "../ai/types";
import type { StimulusEvent } from "../types";

export default function useAudioComposer(events: StimulusEvent[], modelLoaded: boolean) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiStatus, setAIStatus] = useState("Ready");
  const [status, setStatus] = useState("Ready");
  const [plan, setPlan] = useState<CompositionPlan | null>(null);

  async function handlePlayToggle() {
    if (isPlaying) {
      stopAudio();
      stopRuntimeLoop();
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

  return {
    isPlaying,
    aiStatus,
    status,
    plan,
    handlePlayToggle,
    runAIComposer,
  };
}
