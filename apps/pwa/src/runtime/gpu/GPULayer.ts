export class GPULayer {
  private paused = false;

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  renderLoop(render: () => void) {
    const loop = () => {
      if (!this.paused) {
        render();
      }
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}
