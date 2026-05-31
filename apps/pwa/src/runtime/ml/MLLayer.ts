import type { AppConfig } from "@mlc-ai/web-llm";
import type { WorkerInitPayload } from "../core/types";
import { shouldInfer } from "../guards/safariGuards";

export class MLLayer {
  private worker: Worker | null = null;
  private workerReady: Promise<void> | null = null;
  private loadResolve?: () => void;
  private loadReject?: (error: Error) => void;
  private inferResolvers = new Map<string, { resolve: (value: string) => void; reject: (error: Error) => void }>();
  private inferQueue: Array<{ id: string; prompt: string }> = [];
  private inferRunning = false;
  private heartbeatInterval: number | null = null;
  private lastActivity = Date.now();
  private suppressHeartbeatWarnings = false;
  private statusCallback?: (report: { progress?: number; text?: string }) => void;

  setStatusCallback(callback?: (report: { progress?: number; text?: string }) => void) {
    this.statusCallback = callback;
  }

  setSuppressHeartbeatWarnings(value: boolean) {
    this.suppressHeartbeatWarnings = value;
    if (value) {
      this.lastActivity = Date.now();
    }
  }

  async init(model: string, appConfig: AppConfig, initPayload?: WorkerInitPayload): Promise<void> {
    await this.start(initPayload);
    await this.loadModel(model, appConfig);
  }

  async start(initPayload?: WorkerInitPayload) {
    if (this.worker) {
      await this.destroy();
    }

    this.worker = new Worker(new URL("./ml.worker.ts", import.meta.url), { type: "module" });

    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data as Record<string, unknown>;
      this.lastActivity = Date.now();

      if (message?.type === "pong") {
        return;
      }

      if (message?.kind === "toast") {
        const detail = {
          message: String(message.message ?? ""),
          type: String(message.type ?? "info"),
        } as const;
        window.dispatchEvent(new CustomEvent("app-toast", { detail }));
        return;
      }

      if (message?.type === "status") {
        this.statusCallback?.({
          progress: message.progress as number | undefined,
          text: message.text as string | undefined,
        });
      }

      if (message?.type === "ready") {
        this.loadResolve?.();
        this.loadResolve = undefined;
        this.loadReject = undefined;
      }

      if (message?.type === "error") {
        if (this.loadReject) {
          this.loadReject(new Error(String(message.error ?? "Worker error")));
          this.loadResolve = undefined;
          this.loadReject = undefined;
        }
      }

      if (message?.type === "infer-result" && typeof message.id === "string") {
        const resolver = this.inferResolvers.get(message.id);
        if (resolver) {
          resolver.resolve(String(message.result ?? ""));
          this.inferResolvers.delete(message.id);
        }
        this.inferRunning = false;
        this.next();
      }

      if (message?.type === "infer-error" && typeof message.id === "string") {
        const resolver = this.inferResolvers.get(message.id);
        if (resolver) {
          resolver.reject(new Error(String(message.error ?? "Inference error")));
          this.inferResolvers.delete(message.id);
        }
        this.inferRunning = false;
        this.next();
      }
    };

    this.worker.onerror = (event) => {
      const error = new Error("Worker error occurred");
      console.error("Worker error", event);
      this.rejectPendingRequests(error);
      this.destroy();
    };

    this.worker.onmessageerror = (event) => {
      const error = new Error("Worker message error occurred");
      console.error("Worker message error", event);
      this.rejectPendingRequests(error);
      this.destroy();
    };

    this.workerReady = new Promise((resolve, reject) => {
      const listener = (event: MessageEvent) => {
        const message = event.data as Record<string, unknown>;
        if (message?.kind === "worker-ready") {
          this.worker?.removeEventListener("message", listener);
          resolve();
        }
        if (message?.kind === "worker-error") {
          this.worker?.removeEventListener("message", listener);
          reject(new Error(String(message.error ?? "Worker initialization failed")));
        }
      };

      this.worker!.addEventListener("message", listener);
    });

    const transfer: Transferable[] = [];
    const payload: Record<string, unknown> = { type: "init" };
    if (initPayload?.canvas) {
      payload.canvas = initPayload.canvas;
      payload.width = initPayload.width;
      payload.height = initPayload.height;
      transfer.push(initPayload.canvas);
    }

    this.worker.postMessage(payload, transfer);

    this.heartbeatInterval = window.setInterval(() => {
      if (!this.worker) {
        if (this.heartbeatInterval !== null) {
          window.clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
        return;
      }

      if (this.suppressHeartbeatWarnings) {
        return;
      }

      const elapsed = Date.now() - this.lastActivity;
      if (elapsed > 10000) {
        console.warn("Worker heartbeat missing, worker may have died", elapsed);
        window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: "Worker heartbeat missing, model worker may have died.", type: "warning" } }));
      }

      if (elapsed > 5000) {
        try {
          this.worker.postMessage({ type: "ping" });
        } catch (error) {
          console.error("Failed to ping worker", error);
        }
      }
    }, 1000);

    try {
      return await this.workerReady;
    } catch (error) {
      await this.destroy();
      throw error;
    }
  }

  private async loadModel(modelId: string, appConfig: AppConfig) {
    if (!this.worker) {
      throw new Error("Worker is not started");
    }

    return new Promise<void>((resolve, reject) => {
      this.loadResolve = resolve;
      this.loadReject = reject;
      this.worker?.postMessage({ type: "load", model: modelId, appConfig });
    });
  }

  async infer(prompt: string): Promise<string> {
    if (!this.worker) {
      throw new Error("Worker is not started");
    }

    if (!this.workerReady) {
      throw new Error("Worker is not ready");
    }

    await this.workerReady;

    if (!shouldInfer()) {
      throw new Error("Skipping inference: memory pressure");
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    return new Promise<string>((resolve, reject) => {
      this.inferResolvers.set(id, { resolve, reject });
      this.inferQueue.push({ id, prompt });
      this.next();
    });
  }

  run(prompt: string): Promise<string> {
    return this.infer(prompt);
  }

  private async next() {
    if (this.inferRunning) {
      return;
    }

    const nextItem = this.inferQueue.shift();
    if (!nextItem) {
      return;
    }

    this.inferRunning = true;
    try {
      if (!this.worker) {
        throw new Error("Worker is not started");
      }

      this.worker.postMessage({ type: "infer", id: nextItem.id, prompt: nextItem.prompt });
    } catch (error) {
      const resolver = this.inferResolvers.get(nextItem.id);
      if (resolver) {
        resolver.reject(error instanceof Error ? error : new Error(String(error)));
        this.inferResolvers.delete(nextItem.id);
      }
      this.inferRunning = false;
      this.next();
    }
  }

  async unloadModel() {
    if (!this.worker) {
      return;
    }

    this.worker.postMessage({ type: "unload" });
  }

  private rejectPendingRequests(error: Error) {
    if (this.loadReject) {
      this.loadReject(error);
      this.loadResolve = undefined;
      this.loadReject = undefined;
    }

    for (const resolver of this.inferResolvers.values()) {
      resolver.reject(error);
    }
    this.inferResolvers.clear();
    this.inferQueue = [];
    this.inferRunning = false;
  }

  async destroy() {
    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.rejectPendingRequests(new Error("Worker destroyed"));

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.workerReady = null;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
