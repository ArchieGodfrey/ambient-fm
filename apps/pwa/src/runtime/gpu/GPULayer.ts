export class GPULayer {
  private paused = false;
  private rafId: number | null = null;
  private active = false;

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  renderLoop(render: () => void) {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
    }

    this.active = true;
    const loop = () => {
      if (!this.active) {
        return;
      }

      if (!this.paused) {
        render();
      }

      this.rafId = window.requestAnimationFrame(loop);
    };

    this.rafId = window.requestAnimationFrame(loop);
  }

  destroy() {
    this.active = false;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.paused = true;
  }
}
