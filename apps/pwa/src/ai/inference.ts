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
    let recovered: string | null = null;
    try {
      const intent = tryParseJsonWithRecovery(sanitized) as CompositionIntent;
      const seed = createSeed();
      const plan = buildCompositionPlanFromIntent(intent, composerSettings, seed);
      plan.intent = intent;
      const sessions = await getLastSessionSummaries();
      const biasedPlan = applyMemoryBias(plan, sessions);
      biasedPlan.seed = plan.seed;
      biasedPlan.intent = intent;
      dispatchRuntimeStatus({ stage: "infer-ready", text: "Composition ready" });
      return { plan: biasedPlan, intent };
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

