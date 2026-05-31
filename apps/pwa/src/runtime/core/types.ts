export type RuntimeState = "idle" | "ml_load" | "ml_infer" | "gpu" | "audio";

import type { AppConfig } from "@mlc-ai/web-llm";

export interface RuntimeDeps {
  gpu: {
    pause: () => void;
    resume: () => void;
    renderLoop: (render: () => void) => void;
  };
  audio: {
    suspend: () => Promise<void>;
    resume: () => Promise<void>;
  };
  ml: {
    init: (model: string, appConfig: AppConfig, initPayload?: WorkerInitPayload) => Promise<void>;
    run: (prompt: string) => Promise<string>;
    unloadModel: () => Promise<void>;
    destroy: () => Promise<void>;
  };
}

export type WorkerInitPayload = {
  canvas?: OffscreenCanvas;
  width?: number;
  height?: number;
};
