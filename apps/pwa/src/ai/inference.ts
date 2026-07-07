import { getLastSessionSummaries } from "../memory/getMemoryContext";
import { applyMemoryBias } from "../memory/applyMemoryBias";
import { dispatchRuntimeStatus, infer, isModelLoaded } from "../runtime/modelRuntime";
import { buildPrompt, sanitizeJsonResponse, tryParseJsonWithRecovery } from "./prompt";
import { buildCompositionContext } from "./compositionContext";
import { postToast } from "../utils/toast";
import type { CompositionPlan } from "./types";
import type { CompositionIntent } from "./intentSchema";
import { buildCompositionPlanFromIntent } from "./intentToPlan";
import { createSeed } from "../utils/randomField";
import type { ComposerSettings } from "../features/composer/types";
import type { StimulusEvent } from "../types";

export type GeneratedComposition = {
  plan: CompositionPlan;
  intent: CompositionIntent;
};

export async function generateComposition(events: StimulusEvent[], composerSettings: ComposerSettings): Promise<GeneratedComposition> {
  if (!isModelLoaded()) {
    throw new Error("Model not loaded. Load the model before generating a composition.");
  }

  const context = await buildCompositionContext(events, composerSettings);
  const prompt = buildPrompt(context);
  dispatchRuntimeStatus({ stage: "infer-start", text: "Starting AI composition generation" });

  try {
    const text = await infer(prompt);
    dispatchRuntimeStatus({ stage: "infer-complete", text: "Inference completed" });

    if (!text.trim()) {
      throw new Error("Empty response from AI model");
    }

    dispatchRuntimeStatus({ stage: "infer-parse", text: "Parsing AI response" });

    const sanitized = sanitizeJsonResponse(text);

    // Parse step — only JSON parsing lives in this try, so a downstream
    // plan-building error is never mislabeled as a "parse" failure.
    let intent: CompositionIntent;
    try {
      intent = tryParseJsonWithRecovery(sanitized) as CompositionIntent;
    } catch (parseError) {
      const errorMessage = `Failed to parse AI JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}\nSanitized:\n${sanitized}\nRaw:\n${text}`;
      dispatchRuntimeStatus({ stage: "infer-error", text: "AI response was not valid JSON.", rawResponse: text, sanitizedResponse: sanitized });
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Build step — turning the intent into an audible plan (harmony, motifs, memory bias).
    const seed = createSeed();
    const plan = buildCompositionPlanFromIntent(intent, composerSettings, seed);
    plan.intent = intent;
    const sessions = await getLastSessionSummaries();
    const biasedPlan = applyMemoryBias(plan, sessions);
    biasedPlan.seed = plan.seed;
    biasedPlan.intent = intent;
    dispatchRuntimeStatus({ stage: "infer-ready", text: "Composition ready" });
    return { plan: biasedPlan, intent };
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
    seed: createSeed(),
    globalMood: "ambient",
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
    evolutionProfile: {
      motifMutationChance: 0.08,
      chordChangeChance: 0.08,
      instrumentChangeChance: 0.08,
      densityDrift: 0.05,
      rhythmVariation: 0.1,
    },
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
