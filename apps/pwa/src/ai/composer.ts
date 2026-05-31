import * as webllm from "@mlc-ai/web-llm";
import type { AppConfig } from "@mlc-ai/web-llm";
import { resumeAudio, suspendAudio } from "../audio/toneEngine";
import type { StimulusEvent } from "../types";
import type { CompositionPlan } from "./types";
import { AudioLayer } from "../runtime/audio/AudioLayer";
import { GPULayer } from "../runtime/gpu/GPULayer";
import { MLLayer } from "../runtime/ml/MLLayer";
import { RuntimeKernel } from "../runtime/core/RuntimeKernel";
import { Scheduler } from "../runtime/core/Scheduler";
import { assertColdStart, checkMemorySafety } from "../runtime/guards/safariGuards";

type ToastType = "info" | "success" | "warning" | "error";

type WorkerInitPayload = {
  canvas?: OffscreenCanvas;
  width?: number;
  height?: number;
};

type InitProgressReport = {
  progress?: number;
  text?: string;
  timeElapsed?: number;
};

type ToastPayload = {
  message: string;
  type?: ToastType;
};

const gpuLayer = new GPULayer();
const audioLayer = new AudioLayer(suspendAudio, resumeAudio);
const mlLayer = new MLLayer();
const scheduler = new Scheduler();
const runtimeKernel = new RuntimeKernel(gpuLayer, audioLayer, mlLayer, scheduler);

type ModelConfig = {
  model: string;
  model_id: string;
  model_lib: string;
  low_resource_required: boolean;
  vram_required_MB: number;
  overrides: {
    context_window_size: number;
    sliding_window_size?: number;
  };
};

type ModelOption = {
  label: string;
  config: ModelConfig;
};

const availableModelOptions: ModelOption[] = [
  {
    label: "Qwen2.5-0.5B Instruct",
    config: {
      model: "https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
      model_id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
      model_lib: `${webllm.modelLibURLPrefix}${webllm.modelVersion}/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
      low_resource_required: true,
      vram_required_MB: 944.62,
      overrides: {
        context_window_size: 1024,
      },
    },
  },
  {
    label: "Gemma3-1B IT",
    config: {
      model: "https://huggingface.co/mlc-ai/gemma3-1b-it-q4f16_1-MLC",
      model_id: "gemma3-1b-it-q4f16_1-MLC",
      model_lib: `${webllm.modelLibURLPrefix}${webllm.modelVersion}/gemma3-1b-it-q4f16_1_cs1k-webgpu.wasm`,
      low_resource_required: true,
      vram_required_MB: 711.07,
      overrides: {
        context_window_size: 1024,
        sliding_window_size: -1,
      },
    },
  },
];

const appConfig: AppConfig = {
  model_list: availableModelOptions.map((entry) => entry.config),
  cacheBackend: getDefaultCacheBackend(),
};

let loadedModel = false;
let selectedModelId = availableModelOptions[0].config.model_id;

export function getAvailableModels() {
  return availableModelOptions.map((entry) => ({ label: entry.label, model_id: entry.config.model_id }));
}

export function getSelectedModelId() {
  return selectedModelId;
}

export function getSelectedModelLabel() {
  return availableModelOptions.find((entry) => entry.config.model_id === selectedModelId)?.label ?? selectedModelId;
}

export function selectModel(modelId: string) {
  if (!availableModelOptions.some((entry) => entry.config.model_id === modelId)) {
    console.warn("selectModel(): unknown model id", modelId);
    return;
  }

  selectedModelId = modelId;
  loadedModel = false;
}

async function destroyRuntime() {
  loadedModel = false;
  await mlLayer.destroy();
}

async function createRuntime(
  progressCallback?: (report: InitProgressReport) => void,
  initPayload?: WorkerInitPayload,
  suppressHeartbeatWarnings = false,
) {
  mlLayer.setStatusCallback(progressCallback);
  mlLayer.setSuppressHeartbeatWarnings(suppressHeartbeatWarnings);
  await destroyRuntime();
  try {
    await runtimeKernel.init(selectedModelId, appConfig, initPayload);
  } catch (error) {
    await destroyRuntime();
    throw error;
  }
}

export async function downloadModel(progressCallback?: (report: InitProgressReport) => void, initPayload?: WorkerInitPayload) {
  const alreadyCached = await webllm.hasModelInCache(selectedModelId, appConfig);
  if (alreadyCached) {
    dispatchRuntimeStatus({ stage: "download-cached", text: "Model already cached" });
    return;
  }

  dispatchRuntimeStatus({ stage: "download-start", text: "Downloading model" });
  await assertColdStart();
  await checkMemorySafety();
  try {
    await createRuntime(progressCallback, initPayload, true);
    dispatchRuntimeStatus({ stage: "download-loaded", text: "Model download ready" });
    await mlLayer.unloadModel();
    await mlLayer.destroy();
    dispatchRuntimeStatus({ stage: "download-complete", text: "Model downloaded" });
  } catch (error) {
    await destroyRuntime();
    dispatchRuntimeStatus({ stage: "download-error", text: String(error instanceof Error ? error.message : error) });
    throw error;
  }
}

export async function loadModel(progressCallback?: (report: InitProgressReport) => void, initPayload?: WorkerInitPayload) {
  dispatchRuntimeStatus({ stage: "load-start", text: "Loading model" });
  await assertColdStart();
  await checkMemorySafety();
  try {
    await createRuntime(progressCallback, initPayload, true);
    loadedModel = true;
    dispatchRuntimeStatus({ stage: "load-complete", text: "Model loaded" });
  } catch (error) {
    await destroyRuntime();
    dispatchRuntimeStatus({ stage: "load-error", text: String(error instanceof Error ? error.message : error) });
    throw error;
  }
}

export async function unloadModel() {
  if (!loadedModel) {
    return;
  }

  await mlLayer.unloadModel();
  await mlLayer.destroy();
  loadedModel = false;
}

export async function deleteModel() {
  loadedModel = false;
  await mlLayer.destroy();
  await webllm.deleteModelAllInfoInCache(selectedModelId, appConfig);
  await webllm.deleteModelInCache(selectedModelId, appConfig);
}

export async function clearRuntime() {
  loadedModel = false;
  dispatchRuntimeStatus({ stage: "runtime-reset", text: "Resetting runtime" });
  await destroyRuntime();
}

export async function isModelDownloaded() {
  return await webllm.hasModelInCache(selectedModelId, appConfig);
}

export function isModelLoaded() {
  return loadedModel;
}

function buildPrompt(events: StimulusEvent[]) {
  return `
You are an ambient music composer.

Convert the following daily stimulus timeline into a structured music plan.

RULES:
- Output EXACTLY one valid JSON object
- Do NOT include explanations, markdown fences, backticks, or any extra text
- Do NOT wrap the JSON in quotes, code blocks, or markdown formatting
- Only output the JSON object, nothing else

STIMULUS EVENTS:
${events
    .map(
      (e) => `- ${e.source}: ${e.label} (${new Date(e.timestamp).toISOString()})`,
    )
    .join("\n")}

OUTPUT FORMAT:
{
  "key": "string",
  "bpm": number,
  "globalMood": "string",
  "sections": [
    {
      "start": number,
      "duration": number,
      "mood": "calm | focused | tense | ambient | energised",
      "intensity": number
    }
  ],
  "texture": {
    "density": number,
    "brightness": number,
    "reverbAmount": number
  },
  "layers": {
    "drone": number,
    "pad": number,
    "texture": number,
    "pulse": number
  }
}
`;
}

export function fallbackComposition(): CompositionPlan {
  return {
    key: "C minor",
    bpm: 70,
    globalMood: "fallback",
    sections: [],
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
  };
}

function dispatchRuntimeStatus(detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("worker-status", { detail }));
}

function sanitizeJsonResponse(response: string) {
  let text = response.trim();

  // Normalize quotes and remove markdown wrappers
  text = text.replace(/[‘’]/g, '"').replace(/[“”]/g, '"');
  text = text.replace(/```(?:json)?/gi, "");
  text = text.replace(/`/g, "");
  text = text.replace(/^(?:.*?\{)/s, "{");

  const extracted = extractFirstJsonObject(text);
  return extracted ?? text;
}

function extractFirstJsonObject(text: string): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  let startIndex = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = i;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && startIndex !== -1) {
        return text.slice(startIndex, i + 1).trim();
      }
    }
  }

  return null;
}

function escapeJsonStringLiterals(text: string) {
  let inString = false;
  let escape = false;
  let result = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      result += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escape = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (char === "\n") {
        result += "\\n";
        continue;
      }
      if (char === "\r") {
        result += "\\r";
        continue;
      }
      if (char === "\t") {
        result += "\\t";
        continue;
      }
    }

    result += char;
  }

  return result;
}

function tryParseJsonWithRecovery(text: string) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const escaped = escapeJsonStringLiterals(text);
    if (escaped !== text) {
      try {
        return JSON.parse(escaped);
      } catch {
        // continue to fallback
      }
    }

    const trimmed = extractFirstJsonObject(text) ?? text;
    if (trimmed !== text) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // continue to final throw
      }
    }

    throw error;
  }
}

export async function generateComposition(events: StimulusEvent[]) {
  if (!loadedModel) {
    throw new Error("Model not loaded. Load the model before generating a composition.");
  }

  const prompt = buildPrompt(events);
  dispatchRuntimeStatus({ stage: "infer-start", text: "Starting AI composition generation" });

  try {
    const text = await mlLayer.infer(prompt);
    dispatchRuntimeStatus({ stage: "infer-complete", text: "Inference completed" });

    if (!text.trim()) {
      throw new Error("Empty response from AI model");
    }

    dispatchRuntimeStatus({ stage: "infer-parse", text: "Parsing AI response" });

    const sanitized = sanitizeJsonResponse(text);
    let recovered: string | null = null;
    try {
      const plan = tryParseJsonWithRecovery(sanitized) as CompositionPlan;
      dispatchRuntimeStatus({ stage: "infer-ready", text: "Composition ready" });
      return plan;
    } catch (parseError) {
      recovered = escapeJsonStringLiterals(sanitized);
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

function postToast(message: string, type: ToastType = "info") {
  if (typeof window === "undefined") return;
  if (/takes a long time/i.test(message)) return;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>("app-toast", {
      detail: { message, type },
    }),
  );
}

function getDefaultCacheBackend(): "cache" | "indexeddb" {
  if (typeof navigator === "undefined") {
    return "indexeddb";
  }

  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|OPiOS/.test(ua) ? "cache" : "indexeddb";
}
