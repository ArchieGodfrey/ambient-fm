import type { AppConfig } from "@mlc-ai/web-llm";

export async function safariPreflight(appConfig: AppConfig, selectedModelId?: string) {
  if (typeof window === "undefined") {
    throw new Error("Safari preflight must run in a browser environment");
  }

  if (!window.isSecureContext) {
    throw new Error("Not in secure context (HTTPS required)");
  }

  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU not available");
  }

  const limits = adapter.limits;
  validateGpuLimits(limits, appConfig, selectedModelId);

  const bufferMB = (limits.maxBufferSize / 1024 / 1024).toFixed(0);
  const storageMB = (limits.maxStorageBufferBindingSize / 1024 / 1024).toFixed(0);
  const workgroupKB = (limits.maxComputeWorkgroupStorageSize / 1024).toFixed(1);

  console.log("GPU limits:", {
    maxBufferSize: limits.maxBufferSize,
    maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
    maxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize,
  });

  window.dispatchEvent(
    new CustomEvent("worker-status", {
      detail: {
        stage: "gpu-limits",
        text: `GPU limits detected: buffer ${bufferMB}MB, storage binding ${storageMB}MB, compute workgroup ${workgroupKB}KB`,
        gpuMaxBufferSize: limits.maxBufferSize,
        gpuMaxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
        gpuMaxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize,
      },
    }),
  );

  return { adapter, limits };
}

function validateGpuLimits(limits: GPUSupportedLimits, appConfig: AppConfig, selectedModelId?: string) {
  const selectedModel = selectedModelId
    ? appConfig.model_list?.find((entry) => entry.model_id === selectedModelId)
    : appConfig.model_list?.[0];
  const modelRequirementMB = selectedModel?.vram_required_MB ?? 0;
  const availableBufferMB = Math.min(limits.maxBufferSize, limits.maxStorageBufferBindingSize) / 1024 / 1024;
  const requiredBufferMB = modelRequirementMB > 0 ? modelRequirementMB : availableBufferMB * 0.5;
  const minAvailableBufferMB = requiredBufferMB * 0.9;

  const failures: string[] = [];
  if (availableBufferMB < minAvailableBufferMB) {
    failures.push(
      `GPU buffer budget is ${availableBufferMB.toFixed(0)}MB, but the selected model needs ${requiredBufferMB.toFixed(0)}MB. Models up to 10% over the limit are allowed.`,
    );
  }

  const minComputeStorage = Math.max(Math.round(availableBufferMB * 1024 * 0.02), 4 * 1024);
  if (limits.maxComputeWorkgroupStorageSize < minComputeStorage) {
    failures.push(
      `GPU compute workgroup storage is ${limits.maxComputeWorkgroupStorageSize} bytes, but the environment suggests at least ${minComputeStorage} bytes`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`GPU limits too low for AI model load: ${failures.join("; ")}`);
  }
}
