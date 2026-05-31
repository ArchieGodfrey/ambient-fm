import type { RuntimeState } from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Scheduler {
  private state: RuntimeState = "idle";

  async acquire<T>(state: RuntimeState, fn: () => Promise<T>): Promise<T> {
    while (this.state !== "idle") {
      await delay(5);
    }

    this.state = state;

    try {
      return await fn();
    } finally {
      this.state = "idle";
    }
  }

  getState() {
    return this.state;
  }
}
