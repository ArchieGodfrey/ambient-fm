import { getMemoryContext, getLastSessionSummaries } from "../memory/getMemoryContext";
import { applyMemoryBias } from "../memory/applyMemoryBias";
import { computeEmotionalState } from "../stimulus/emotionalState";
import { dispatchRuntimeStatus, infer, isModelLoaded } from "../runtime/modelRuntime";
import { buildPrompt, sanitizeJsonResponse, tryParseJsonWithRecovery } from "./prompt";
import { postToast } from "../utils/toast";
import type { CompositionPlan } from "./types";
import type { StimulusEvent } from "../types";

export async function generateComposition(events: StimulusEvent[]) {
  if (!isModelLoaded()) {
    throw new Error("Model not loaded. Load the model before generating a composition.");
  }

  const memoryContext = await getMemoryContext();
  const emotionalState = computeEmotionalState(events);
  const prompt = buildPrompt(emotionalState, memoryContext, events);
  dispatchRuntimeStatus({ stage: "infer-start", text: "Starting AI composition generation" });

  try {
    const text = await infer(prompt);
    dispatchRuntimeStatus({ stage: "infer-complete", text: "Inference completed" });

    if (!text.trim()) {
      throw new Error("Empty response from AI model");
    }

    dispatchRuntimeStatus({ stage: "infer-parse", text: "Parsing AI response" });

    const sanitized = sanitizeJsonResponse(text);
    let recovered: string | null = null;
    try {
      const plan = tryParseJsonWithRecovery(sanitized) as CompositionPlan;
      plan.motifs = Array.isArray((plan as any).motifs) ? (plan as any).motifs : [];
      const sessions = await getLastSessionSummaries();
      const biasedPlan = applyMemoryBias(plan, sessions);
      dispatchRuntimeStatus({ stage: "infer-ready", text: "Composition ready" });
      return biasedPlan;
    } catch (parseError) {
      recovered = sanitizeJsonResponse(sanitized);
      const errorMessage = `Failed to parse AI JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}\nSanitized text:\n${sanitized}\nRecovered text:\n${recovered}\nRaw response:\n${text}`;
      dispatchRuntimeStatus({
        stage: "infer-error",
        text: `AI data parse failed. Inspect rawResponse for details.`,
        rawResponse: text,
        sanitizedResponse: sanitized,
        recoveredResponse: recovered,
      });
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI composer failed", error);
    dispatchRuntimeStatus({ stage: "infer-error", text: `AI composition failed: ${message}` });
    postToast(`AI composer failed: ${message}`, "error");
    throw error instanceof Error ? error : new Error(message);
  }
}

export function fallbackComposition(): CompositionPlan {
  return {
    key: "C minor",
    bpm: 70,
    duration: 30,
    globalMood: "fallback",
    sections: [
      {
        start: 0,
        duration: 15,
        mood: "calm",
        intensity: 0.4,
        phraseIds: ["phrase-1"],
      },
      {
        start: 15,
        duration: 15,
        mood: "focused",
        intensity: 0.7,
        phraseIds: ["phrase-2"],
      },
    ],
    texture: {
      density: 0.5,
      brightness: 0.5,
      reverbAmount: 0.5,
    },
    layers: {
      drone: 0.5,
      pad: 0.5,
      texture: 0.5,
      pulse: 0.2,
    },
    motifs: [
      {
        id: "pad-1",
        layer: "pad",
        notes: ["C4", "E4", "G4"],
        rhythm: [1, 0.5, 1],
      },
      {
        id: "pulse-1",
        layer: "pulse",
        notes: ["C2", "C3"],
        rhythm: [0.5, 0.5],
      },
      {
        id: "texture-1",
        layer: "texture",
        notes: ["G3", "B3"],
        rhythm: [1, 0.5, 0.5],
      },
    ],
    phrases: [
      {
        id: "phrase-1",
        motifs: ["pad-1", "texture-1"],
        length: 15,
        variation: 0.1,
        role: "static",
      },
      {
        id: "phrase-2",
        motifs: ["pad-1", "pulse-1"],
        length: 15,
        variation: 0.3,
        role: "build",
      },
    ],
  };
}
