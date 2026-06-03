import * as webllm from "@mlc-ai/web-llm";
import type { AppConfig } from "@mlc-ai/web-llm";

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
        context_window_size: 4096,
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

let selectedModelId = availableModelOptions[0].config.model_id;

function getDefaultCacheBackend(): "cache" | "indexeddb" {
  if (typeof navigator === "undefined") {
    return "indexeddb";
  }

  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|OPiOS/.test(ua) ? "cache" : "indexeddb";
}

export const appConfig: AppConfig = {
  model_list: availableModelOptions.map((entry) => entry.config),
  cacheBackend: getDefaultCacheBackend(),
};

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
}
