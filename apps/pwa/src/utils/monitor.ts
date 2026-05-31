type MonitorState = Record<string, string | number>;

type SamplerUpdate = (state: MonitorState) => void;

type MemoryInfo = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
};

function getMemoryInfoSync(): MemoryInfo | null {
  const perf = performance as any;
  if (perf.memory && typeof perf.memory.usedJSHeapSize === "number" && typeof perf.memory.jsHeapSizeLimit === "number") {
    return perf.memory;
  }
  return null;
}

async function getMemoryInfoAsync(): Promise<MemoryInfo | null> {
  const perf = performance as any;
  if (typeof perf.measureMemory === "function") {
    try {
      const result = await perf.measureMemory();
      if (result && typeof result.bytes === "number") {
        return {
          usedJSHeapSize: result.bytes,
          jsHeapSizeLimit: typeof result.quota === "number" ? result.quota : result.bytes * 2,
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

function getMemoryInfoFallback(): MemoryInfo | null {
  const deviceMemory = (navigator as any).deviceMemory;
  if (typeof deviceMemory === "number" && deviceMemory > 0) {
    const jsHeapSizeLimit = deviceMemory * 1024 * 1024 * 1024;
    return {
      usedJSHeapSize: NaN,
      jsHeapSizeLimit,
    };
  }
  return null;
}

export function createMonitor() {
  const el = document.createElement("div");
  let visible = false;

  el.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 999999;
    font-family: monospace;
    font-size: 12px;
    background: rgba(0,0,0,0.75);
    color: #00ff88;
    padding: 10px;
    border-radius: 8px;
    width: 280px;
    pointer-events: none;
    line-height: 1.4;
  `;

  document.body.appendChild(el);

  function setVisible(value: boolean) {
    visible = value;
    el.style.display = value ? "block" : "none";
  }

  function toggle() {
    setVisible(!visible);
  }

  return {
    update(state: MonitorState) {
      el.innerHTML = Object.entries(state)
        .map(([k, v]) => `${k}: ${v}`)
        .join("<br>");
    },
    toggle,
    setVisible,
    isVisible() {
      return visible;
    },
  };
}

export function startSampler(update: SamplerUpdate) {
  let framesThisInterval = 0;
  let intervalStart = performance.now();
  let fps = "0.0";
  let latestMemory: MemoryInfo | null = getMemoryInfoSync() ?? getMemoryInfoFallback();

  async function refreshMemory() {
    const asyncMem = await getMemoryInfoAsync();
    if (asyncMem) {
      latestMemory = asyncMem;
    }
    if (!latestMemory) {
      latestMemory = getMemoryInfoFallback();
    }
    setTimeout(refreshMemory, 1000);
  }

  refreshMemory();

  function loop() {
    const now = performance.now();
    framesThisInterval++;

    const elapsedSinceInterval = now - intervalStart;
    if (elapsedSinceInterval >= 500) {
      fps = (framesThisInterval * 1000 / elapsedSinceInterval).toFixed(1);
      intervalStart = now;
      framesThisInterval = 0;
    }

    const mem = latestMemory ?? getMemoryInfoSync() ?? getMemoryInfoFallback();
    const state: MonitorState = {
      fps,
      heap: mem && !Number.isNaN(mem.usedJSHeapSize)
        ? `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`
        : "unknown",
      limit: mem ? `${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB` : "unknown",
    };

    update(state);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

export function startCrashDetector(update: SamplerUpdate) {
  setInterval(async () => {
    const mem = getMemoryInfoSync() ?? await getMemoryInfoAsync();
    if (!mem) return;

    const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
    let pressure = "normal";

    if (ratio > 0.9) {
      pressure = "critical";
      console.error("🔥 near OOM — model likely to crash soon", ratio.toFixed(2));
    } else if (ratio > 0.75) {
      pressure = "high";
      console.warn("⚠️ high memory pressure", ratio.toFixed(2));
    }

    update({ pressure, heapRatio: ratio.toFixed(2) });
  }, 500);
}
