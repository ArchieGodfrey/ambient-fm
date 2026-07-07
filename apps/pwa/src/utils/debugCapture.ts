import { useAppStore } from "../store/useAppStore";

// Mirror console.warn / console.error into the app store so they can be shown
// in-app (the debug log panel) when developer mode is on — useful for warnings
// the browser emits but never throws (e.g. the AudioContext autoplay warning).
let installed = false;

export function installDebugCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const format = (args: unknown[]) =>
    args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.message;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(" ")
      .slice(0, 500);

  const wrap = (level: "warn" | "error", original: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      try {
        useAppStore.getState().pushLog({ level, message: format(args), ts: Date.now() });
      } catch {
        // never let logging break the app
      }
      original(...args);
    };

  console.warn = wrap("warn", console.warn.bind(console));
  console.error = wrap("error", console.error.bind(console));
}
