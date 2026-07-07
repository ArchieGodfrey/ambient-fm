import { useAppStore } from "../store/useAppStore";

// Mirror console.warn / console.error into the app store so they can be shown
// in-app (the debug log panel) when developer mode is on — useful for warnings
// the browser emits but never throws (e.g. the AudioContext autoplay warning).
let installed = false;

export function installDebugCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const push = (level: "warn" | "error", message: string) => {
    try {
      useAppStore.getState().pushLog({ level, message: message.slice(0, 600), ts: Date.now() });
    } catch { /* never let logging break the app */ }
  };

  const format = (args: unknown[]) =>
    args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.stack ? `${a.message}\n${a.stack}` : a.message;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(" ")
      .slice(0, 600);

  // Capture uncaught errors + promise rejections so a crash (esp. on iOS) leaves
  // a persisted trail we can read after reload.
  window.addEventListener("error", (e) => {
    push("error", `Uncaught: ${e.message}${e.filename ? ` @ ${e.filename}:${e.lineno}` : ""}${e.error?.stack ? `\n${e.error.stack}` : ""}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    push("error", `Unhandled rejection: ${r instanceof Error ? `${r.message}\n${r.stack ?? ""}` : String(r)}`);
  });

  const wrap = (level: "warn" | "error", original: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      push(level, format(args));
      original(...args);
    };

  console.warn = wrap("warn", console.warn.bind(console));
  console.error = wrap("error", console.error.bind(console));
}
