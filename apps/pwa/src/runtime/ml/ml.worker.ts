import "../../polyfills.ts";
import { CreateMLCEngine, type AppConfig } from "@mlc-ai/web-llm";

let engine: any = null;
let device: GPUDevice | null = null;
let context: GPUCanvasContext | null = null;
let format: GPUTextureFormat | null = null;
let canvasRef: OffscreenCanvas | null = null;
let ready: Promise<void> | null = null;
let inferBusy = false;

const GPU_BUFFER_USAGE_STORAGE = 0x80;
const GPU_BUFFER_USAGE_COPY_DST = 0x04;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uploadChunk(device: GPUDevice, chunk: ArrayBufferLike): GPUBuffer {
  const buffer = device.createBuffer({
    size: chunk.byteLength,
    usage: GPU_BUFFER_USAGE_STORAGE | GPU_BUFFER_USAGE_COPY_DST,
    mappedAtCreation: true,
  });

  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(chunk));
  buffer.unmap();

  return buffer;
}

async function uploadChunks(device: GPUDevice, chunks: ArrayBufferLike[]) {
  for (const chunk of chunks) {
    const gpuBuffer = uploadChunk(device, chunk);
    gpuBuffer.destroy?.();
    await delay(5);
  }
}

async function configureWebGPU(canvas?: OffscreenCanvas, width?: number, height?: number) {
  if (!("gpu" in navigator)) {
    const message = "WebGPU not available in worker";
    self.postMessage({ kind: "toast", type: "warning", message });
    console.warn(message);
    throw new Error(message);
  }

  if (canvas) {
    canvasRef = canvas;
    canvas.width = width ?? canvas.width;
    canvas.height = height ?? canvas.height;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    const message = "No GPU adapter available";
    self.postMessage({ kind: "toast", type: "warning", message });
    throw new Error(message);
  }

  const limits = adapter.limits;
  const bufferMB = Math.round(limits.maxBufferSize / 1024 / 1024);
  const storageMB = Math.round(limits.maxStorageBufferBindingSize / 1024 / 1024);
  const workgroupKB = (limits.maxComputeWorkgroupStorageSize / 1024).toFixed(1);

  self.postMessage({
    type: "status",
    stage: "gpu-limits",
    progress: 0,
    text: `GPU limits detected: buffer ${bufferMB}MB, storage binding ${storageMB}MB, compute workgroup ${workgroupKB}KB`,
    gpuMaxBufferSize: limits.maxBufferSize,
    gpuMaxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
    gpuMaxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize,
  });

  device = await adapter.requestDevice();

  if (canvasRef) {
    context = canvasRef.getContext("webgpu") as GPUCanvasContext | null;
    if (!context) {
      throw new Error("Failed to get WebGPU context from OffscreenCanvas");
    }
    format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: "premultiplied",
    });
  }
}

async function initWorker(initPayload?: { canvas?: OffscreenCanvas; width?: number; height?: number }) {
  if (ready) return ready;

  ready = (async () => {
    try {
      await configureWebGPU(initPayload?.canvas, initPayload?.width, initPayload?.height);
      self.postMessage({ type: "status", stage: "init", progress: 0 });
      self.postMessage({ kind: "worker-ready" });
    } catch (error) {
      const message = `Worker initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      self.postMessage({ type: "status", stage: "error", progress: 0, error: message });
      self.postMessage({ kind: "worker-error", error: message });
      throw error;
    }
  })();

  return ready;
}

async function loadModel(model: string, appConfig: AppConfig) {
  try {
    if (device) {
      const testChunk = new Uint8Array(16 * 1024).buffer;
      await uploadChunks(device, [testChunk]);
    }

    const config = {
      appConfig,
      logLevel: "ERROR",
      wasmThreads: 1,
      initProgressCallback: (report?: { progress?: number; text?: string }) => {
        self.postMessage({
          type: "status",
          stage: report?.text?.toLowerCase().includes("ready") ? "ready" : "loading",
          progress: report?.progress ?? 0,
          text: report?.text,
        });
      },
    } as any;

    const originalPromiseAll = Promise.all;
    Promise.all = async function (iterable: Iterable<any>) {
      const promises = Array.from(iterable as any);
      const results: any[] = [];
      for (const promise of promises) {
        results.push(await promise);
        await delay(5);
      }
      return results as any;
    } as any;

    try {
      engine = await CreateMLCEngine(model, config);
    } finally {
      Promise.all = originalPromiseAll;
    }

    self.postMessage({ type: "status", stage: "loading", progress: 0, text: "Loading model" });
    self.postMessage({ type: "ready" });
  } catch (error) {
    const message = `Model load failed: ${error instanceof Error ? error.message : String(error)}`;
    self.postMessage({ type: "status", stage: "error", progress: 0, error: message });
    self.postMessage({ type: "error", error: message });
    throw error;
  }
}

function isMemorySafeForInference() {
  if (typeof performance === "undefined" || !("memory" in performance)) {
    return true;
  }

  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem || !mem.usedJSHeapSize || !mem.jsHeapSizeLimit) {
    return true;
  }

  return mem.usedJSHeapSize / mem.jsHeapSizeLimit < 0.75;
}

async function infer(id: string, prompt: string) {
  if (!engine) {
    throw new Error("Engine not initialized");
  }

  if (inferBusy) {
    throw new Error("Engine busy (concurrent inference blocked)");
  }

  if (!isMemorySafeForInference()) {
    throw new Error("Skipping inference: memory pressure");
  }

  self.postMessage({ type: "status", stage: "infer-start", progress: 0.05, text: "Starting inference" });
  inferBusy = true;
  try {
    const response = await engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 256,
    });
    const text = response.choices?.[0]?.message?.content ?? "";
    self.postMessage({ type: "status", stage: "infer-complete", progress: 0.7, text: "Inference complete" });
    self.postMessage({ type: "infer-result", id, result: text });
  } catch (error) {
    const message = `Inference failed: ${error instanceof Error ? error.message : String(error)}`;
    self.postMessage({ type: "status", stage: "infer-error", progress: 0, text: message });
    self.postMessage({ type: "infer-error", id, error: message });
  } finally {
    inferBusy = false;
  }
}

async function unloadModel() {
  if (!engine) {
    return;
  }

  try {
    await engine.unload();
  } catch (error) {
    const message = `Unload failed: ${error instanceof Error ? error.message : String(error)}`;
    self.postMessage({ kind: "toast", type: "warning", message });
  }

  engine = null;
}

function pauseWebGPU() {
  if (context && typeof context.unconfigure === "function") {
    context.unconfigure();
    self.postMessage({ kind: "toast", type: "info", message: "GPU worker paused for safe model load" });
  }
}

function resumeWebGPU() {
  if (!context && device && canvasRef && format) {
    const resumedContext = canvasRef.getContext("webgpu") as GPUCanvasContext | null;
    if (resumedContext) {
      context = resumedContext;
      context.configure({
        device,
        format,
        alphaMode: "premultiplied",
      });
      self.postMessage({ kind: "toast", type: "info", message: "GPU worker resumed after safe model load" });
    }
  }
}

self.onerror = (event: any) => {
  const message = typeof event === "string" ? event : event?.message ?? "Worker uncaught error";
  const filename = typeof event === "string" ? "unknown" : event?.filename ?? "unknown";
  const lineno = typeof event === "string" ? 0 : event?.lineno ?? 0;
  const colno = typeof event === "string" ? 0 : event?.colno ?? 0;
  self.postMessage({ type: "status", stage: "worker-error", progress: 0, text: `Worker uncaught error: ${message} at ${filename}:${lineno}:${colno}` });
  self.postMessage({ kind: "worker-error", error: `Worker error: ${message}` });
};

self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  self.postMessage({ type: "status", stage: "worker-error", progress: 0, text: `Worker unhandled rejection: ${reason}` });
  self.postMessage({ kind: "worker-error", error: `Worker rejection: ${reason}` });
};

self.onmessage = async (event) => {
  const data = event.data;
  if (data?.type === "ping") {
    self.postMessage({ type: "pong" });
    return;
  }

  if (data?.type === "gpu-pause") {
    pauseWebGPU();
    return;
  }

  if (data?.type === "gpu-resume") {
    resumeWebGPU();
    return;
  }

  if (data?.type === "init") {
    await initWorker({ canvas: data.canvas, width: data.width, height: data.height });
    return;
  }

  if (data?.type === "load") {
    await ready;
    await loadModel(data.model, data.appConfig as AppConfig);
    return;
  }

  if (data?.type === "infer") {
    if (!data?.id) {
      self.postMessage({ type: "infer-error", id: data.id, error: "Missing inference request id" });
      return;
    }

    await ready;

    if (inferBusy) {
      self.postMessage({ type: "infer-error", id: data.id, error: "Engine busy (concurrent inference blocked)" });
      return;
    }

    if (!isMemorySafeForInference()) {
      self.postMessage({ type: "infer-error", id: data.id, error: "Skipping inference: memory pressure" });
      return;
    }

    await infer(data.id, data.prompt);
    return;
  }

  if (data?.type === "unload") {
    await unloadModel();
    return;
  }

  const message = "Worker received unknown message type";
  self.postMessage({ kind: "toast", type: "warning", message });
  console.warn(message, data);
};

export {};