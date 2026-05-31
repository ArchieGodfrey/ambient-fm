export async function checkMemorySafety() {
  if (typeof performance === "undefined" || !("memory" in performance)) {
    return true;
  }

  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem || !mem.usedJSHeapSize || !mem.jsHeapSizeLimit) {
    return true;
  }

  const usageRatio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
  if (usageRatio > 0.6) {
    throw new Error(`Unsafe memory state for model load: ${(usageRatio * 100).toFixed(0)}% JS heap used`);
  }

  return true;
}

export function assertColdStart() {
  if (typeof performance === "undefined" || !("memory" in performance)) {
    return;
  }

  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem || !mem.usedJSHeapSize || !mem.jsHeapSizeLimit) {
    return;
  }

  const usage = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
  if (usage > 0.5) {
    throw new Error("Memory too warm for model load (Safari safety gate)");
  }
}

export function shouldInfer() {
  if (typeof performance === "undefined" || !("memory" in performance)) {
    return true;
  }

  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem || !mem.usedJSHeapSize || !mem.jsHeapSizeLimit) {
    return true;
  }

  return mem.usedJSHeapSize / mem.jsHeapSizeLimit < 0.75;
}
