export class LatestSyncCoordinator<T> {
  private running = false;
  private rerun = false;
  private waiters: Array<{ resolve: (value: T) => void; reject: (error: unknown) => void }> = [];

  public constructor(private readonly sync: () => Promise<T>) {}

  public request(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      if (this.running) { this.rerun = true; return; }
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    this.running = true;
    try {
      let result!: T;
      do { this.rerun = false; result = await this.sync(); } while (this.rerun);
      for (const waiter of this.waiters.splice(0)) waiter.resolve(result);
    } catch (error) {
      for (const waiter of this.waiters.splice(0)) waiter.reject(error);
    } finally {
      this.running = false;
      if (this.waiters.length) void this.drain();
    }
  }
}
