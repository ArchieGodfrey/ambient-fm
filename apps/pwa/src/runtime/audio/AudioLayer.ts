export class AudioLayer {
  private suspendFn: () => Promise<void>;
  private resumeFn: () => Promise<void>;

  constructor(suspendFn: () => Promise<void>, resumeFn: () => Promise<void>) {
    this.suspendFn = suspendFn;
    this.resumeFn = resumeFn;
  }

  suspend() {
    return this.suspendFn();
  }

  resume() {
    return this.resumeFn();
  }
}
