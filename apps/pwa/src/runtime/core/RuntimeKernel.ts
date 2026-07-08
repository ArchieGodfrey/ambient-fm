import { Scheduler } from "./Scheduler";
import { safariPreflight } from "../guards/preflight";
import type { AppConfig } from "@mlc-ai/web-llm";
import type { RuntimeDeps, WorkerInitPayload } from "./types";

export class RuntimeKernel {
  private gpu: RuntimeDeps["gpu"];
  private audio: RuntimeDeps["audio"];
  private ml: RuntimeDeps["ml"];
  private scheduler: Scheduler;

  constructor(
    gpu: RuntimeDeps["gpu"],
    audio: RuntimeDeps["audio"],
    ml: RuntimeDeps["ml"],
    scheduler: Scheduler,
  ) {
    this.gpu = gpu;
    this.audio = audio;
    this.ml = ml;
    this.scheduler = scheduler;
  }

  // opts.keepAudio: don't suspend the audio context during the load. The model
  // loads in its own Worker/WebGPU device and Web Audio runs on the audio thread,
  // so a mid-session reload can happen with the music still playing. (Cold start
  // still suspends — there's no audio to protect then, and it avoids any startup
  // contention.)
  async init(model: string, appConfig: AppConfig, initPayload?: WorkerInitPayload, opts?: { keepAudio?: boolean }) {
    await safariPreflight(appConfig, model);

    return this.scheduler.acquire("ml_load", async () => {
      this.gpu.pause();
      if (!opts?.keepAudio) {
        await this.audio.suspend();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      try {
        return await this.ml.init(model, appConfig, initPayload);
      } finally {
        this.gpu.resume();
        if (!opts?.keepAudio) await this.audio.resume();
      }
    });
  }

  async infer(prompt: string) {
    return this.scheduler.acquire("ml_infer", async () => {
      this.gpu.pause();
      await this.audio.suspend();

      try {
        return await this.ml.run(prompt);
      } finally {
        this.gpu.resume();
        await this.audio.resume();
      }
    });
  }

  startAmbient(render: () => void) {
    this.scheduler.acquire("gpu", async () => {
      this.gpu.resume();
      await this.audio.resume();
      this.gpu.renderLoop(render);
    });
  }
}
