import { useEffect, useState } from "react";
import {
  downloadModel,
  loadModel,
  unloadModel,
  deleteModel,
  clearRuntime,
  isModelDownloaded,
  isModelLoaded,
} from "../ai/composer";
import { postToast } from "../utils/toast";

type WorkerInitPayload = {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
};

export type InitProgressReport = {
  progress?: number;
  text?: string;
  stage?: string;
  gpuMaxBufferSize?: number;
  gpuMaxStorageBufferBindingSize?: number;
  gpuMaxComputeWorkgroupStorageSize?: number;
  heap?: string;
};

export default function useModelManager(workerInitPayload?: WorkerInitPayload) {
  const [status, setStatus] = useState("Ready");
  const [modelDownloaded, setModelDownloaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [gpuStatus, setGpuStatus] = useState<string | null>(null);
  const [gpuLimits, setGpuLimits] = useState<{
    maxBufferSizeMB: number;
    maxStorageBufferBindingSizeMB: number;
    maxComputeWorkgroupStorageSize: number;
  } | null>(null);
  const [heapUsage, setHeapUsage] = useState<string | null>(getHeapUsage());

  function getHeapUsage() {
    if (typeof performance === "undefined" || !("memory" in performance)) {
      return "unavailable";
    }

    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (!mem || !mem.usedJSHeapSize || !mem.jsHeapSizeLimit) {
      return "unavailable";
    }

    return `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB / ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB`;
  }

  async function checkModelState() {
    try {
      const downloaded = await isModelDownloaded();
      setModelDownloaded(downloaded);
      setModelLoaded(isModelLoaded());
    } catch (error) {
      console.error("Failed to read model state", error);
    }
  }

  useEffect(() => {
    checkModelState();

    const onWorkerStatus = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail) return;

      if (detail.stage === "gpu-limits") {
        setGpuStatus(String(detail.text ?? "GPU limits received"));
      } else if (detail.stage === "preflight") {
        setGpuStatus(String(detail.text ?? "Preflight check"));
      }

      if (detail.gpuMaxBufferSize != null || detail.gpuMaxStorageBufferBindingSize != null || detail.gpuMaxComputeWorkgroupStorageSize != null) {
        setGpuLimits({
          maxBufferSizeMB: typeof detail.gpuMaxBufferSize === "number" ? detail.gpuMaxBufferSize / 1024 / 1024 : 0,
          maxStorageBufferBindingSizeMB: typeof detail.gpuMaxStorageBufferBindingSize === "number" ? detail.gpuMaxStorageBufferBindingSize / 1024 / 1024 : 0,
          maxComputeWorkgroupStorageSize: typeof detail.gpuMaxComputeWorkgroupStorageSize === "number" ? detail.gpuMaxComputeWorkgroupStorageSize : 0,
        });
      }

      if (detail.stage) {
        const stage = detail.stage.toString();
        switch (stage) {
          case "download-start":
            setModelProgress(0.05);
            break;
          case "download-loaded":
            setModelProgress(0.7);
            break;
          case "download-complete":
            setModelProgress(1);
            break;
          case "download-error":
            setModelProgress(null);
            break;
          case "load-start":
            setModelProgress(0.05);
            break;
          case "load-complete":
            setModelProgress(1);
            break;
          case "load-error":
            setModelProgress(null);
            break;
          case "infer-start":
            setModelProgress(0.1);
            break;
          case "infer-complete":
            setModelProgress(0.7);
            break;
          case "infer-parse":
            setModelProgress(0.85);
            break;
          case "infer-ready":
            setModelProgress(1);
            break;
          case "infer-error":
            setModelProgress(null);
            break;
          case "runtime-reset":
            setModelProgress(null);
            break;
          default:
            break;
        }
      }

      if (detail.text != null) {
        const text = normalizeProgressText(String(detail.text));
        if (text) {
          setProgressText(text);
          setStatus(text);
        }
      }

      if (detail.heap != null) {
        setHeapUsage(String(detail.heap));
      } else {
        setHeapUsage(getHeapUsage());
      }
    };

    window.addEventListener("worker-status", onWorkerStatus as EventListener);
    return () => window.removeEventListener("worker-status", onWorkerStatus as EventListener);
  }, []);

  function normalizeProgressText(text?: string) {
    if (!text) return undefined;
    if (/takes a long time/i.test(text)) {
      return undefined;
    }
    return text;
  }

  async function handleProgress(report: InitProgressReport) {
    if (report.progress != null) {
      setModelProgress(report.progress);
    } else if (report.stage) {
      switch (report.stage) {
        case "downloading":
          setModelProgress((prev) => prev ?? 0.05);
          break;
        case "decoding":
          setModelProgress((prev) => Math.max(prev ?? 0.2, 0.25));
          break;
        case "allocating_kv":
          setModelProgress((prev) => Math.max(prev ?? 0.5, 0.55));
          break;
        case "ready":
          setModelProgress(1);
          break;
        case "loading":
          setModelProgress((prev) => prev ?? 0.05);
          break;
        default:
          break;
      }
    }

    const text = normalizeProgressText(report.text ?? report.stage);
    if (text) {
      setProgressText(text);
      setStatus(text);
    }
  }

  async function downloadModelAction() {
    const alreadyDownloaded = await isModelDownloaded();
    const actionText = alreadyDownloaded ? "Model already cached. Ready to load from cache." : "Starting model download...";
    setStatus(actionText);
    setModelProgress(0);
    setProgressText(actionText);

    try {
      if (!alreadyDownloaded) {
        await downloadModel(handleProgress, workerInitPayload);
        setModelDownloaded(true);
        setModelLoaded(false);
        setModelProgress(1);
        setStatus("Model downloaded to cache");
      } else {
        setModelProgress(1);
        setStatus("Model already cached");
      }
    } catch (error) {
      console.error("Download model failed", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Download failed: ${message}`, "error");
      setStatus(`Download failed: ${message}`);
    } finally {
      setModelProgress((prev) => (prev === 1 ? 1 : null));
      setProgressText(null);
    }

    await checkModelState();
  }

  async function loadModelAction() {
    setStatus("Starting model load...");
    setModelProgress(0);
    setProgressText("Loading model...");

    try {
      await loadModel(handleProgress, workerInitPayload);
      setModelLoaded(true);
      setModelProgress(1);
      setStatus("Model loaded");
    } catch (error) {
      console.error("Load model failed", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Load failed: ${message}`, "error");
      setStatus(`Load failed: ${message}`);
    } finally {
      setModelProgress((prev) => (prev === 1 ? 1 : null));
      setProgressText(null);
    }

    await checkModelState();
  }

  async function unloadModelAction() {
    setStatus("Unloading model...");
    try {
      await unloadModel();
      setModelLoaded(false);
      setStatus("Model unloaded from memory");
    } catch (error) {
      console.error("Unload model failed", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Unload failed: ${message}`, "error");
      setStatus(`Unload failed: ${message}`);
    }

    await checkModelState();
  }

  async function deleteModelAction() {
    setStatus("Deleting model cache...");
    try {
      await deleteModel();
      setModelDownloaded(false);
      setModelLoaded(false);
      setStatus("Model cache deleted");
      setGpuStatus(null);
      setGpuLimits(null);
      setHeapUsage(null);
    } catch (error) {
      console.error("Delete model failed", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Delete failed: ${message}`, "error");
      setStatus(`Delete failed: ${message}`);
    }

    await checkModelState();
  }

  async function resetRuntimeAction() {
    setStatus("Resetting runtime...");
    try {
      await clearRuntime();
      setModelLoaded(false);
      setGpuStatus(null);
      setGpuLimits(null);
      setHeapUsage(null);
      setStatus("Runtime reset complete");
    } catch (error) {
      console.error("Reset runtime failed", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Reset failed: ${message}`, "error");
      setStatus(`Reset failed: ${message}`);
    }

    await checkModelState();
  }

  return {
    status,
    modelDownloaded,
    modelLoaded,
    modelProgress,
    progressText,
    gpuStatus,
    gpuLimits,
    heapUsage,
    downloadModelAction,
    loadModelAction,
    unloadModelAction,
    deleteModelAction,
    resetRuntimeAction,
    checkModelState,
  };
}
