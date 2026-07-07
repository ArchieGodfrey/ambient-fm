import * as webllm from "@mlc-ai/web-llm";
import { resumeAudio, suspendAudio } from "../audio/toneEngine";
import { AudioLayer } from "../runtime/audio/AudioLayer";
import { GPULayer } from "../runtime/gpu/GPULayer";
import { MLLayer } from "../runtime/ml/MLLayer";
import { RuntimeKernel } from "../runtime/core/RuntimeKernel";
import { Scheduler } from "../runtime/core/Scheduler";
import type { RuntimeState } from "../runtime/core/types";
import { assertColdStart, checkMemorySafety } from "../runtime/guards/safariGuards";
import { appConfig, getSelectedModelId } from "./modelSelection";

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

const gpuLayer = new GPULayer();
const audioLayer = new AudioLayer(suspendAudio, resumeAudio);
const mlLayer = new MLLayer();
const scheduler = new Scheduler();
const runtimeKernel = new RuntimeKernel(gpuLayer, audioLayer, mlLayer, scheduler);

let loadedModel = false;

async function destroyRuntime() {
  loadedModel = false;
  await mlLayer.destroy();
  gpuLayer.destroy();
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
    await runtimeKernel.init(getSelectedModelId(), appConfig, initPayload);
  } catch (error) {
    await destroyRuntime();
    throw error;
  }
}

export async function downloadModel(progressCallback?: (report: InitProgressReport) => void, initPayload?: WorkerInitPayload) {
  const alreadyCached = await webllm.hasModelInCache(getSelectedModelId(), appConfig);
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
  await webllm.deleteModelAllInfoInCache(getSelectedModelId(), appConfig);
  await webllm.deleteModelInCache(getSelectedModelId(), appConfig);
}

export async function clearRuntime() {
  loadedModel = false;
  dispatchRuntimeStatus({ stage: "runtime-reset", text: "Resetting runtime" });
  await destroyRuntime();
}

export async function infer(prompt: string) {
  // Serialize inference on the shared mutex too, so LLM infer never overlaps a
  // model load or a Kokoro TTS render — one queue for all heavy GPU/compute work.
  return scheduler.acquire("ml_infer", () => mlLayer.infer(prompt));
}

// Run a GPU/compute task under the shared runtime mutex, so it never overlaps a
// model load (or another exclusive task like Kokoro TTS rendering). Used to keep
// second-model work (Kokoro) orchestrated with the LLM runtime.
export function runExclusive<T>(label: RuntimeState, fn: () => Promise<T>): Promise<T> {
  return scheduler.acquire(label, fn);
}

export async function isModelDownloaded() {
  return await webllm.hasModelInCache(getSelectedModelId(), appConfig);
}

export function isModelLoaded() {
  return loadedModel;
}

export function dispatchRuntimeStatus(detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("worker-status", { detail }));
}
