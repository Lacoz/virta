export interface RuntimeMonitorOptions {
  timeoutMs: number;
  thresholdPercent?: number; // e.g. 80 for 80%
}

export class RuntimeMonitor {
  private readonly startTime: number;
  private readonly timeoutMs: number;
  private readonly warningThresholdMs: number;
  private warningEmitted = false;
  private onWarningCallback?: () => Promise<void> | void;

  constructor(options: RuntimeMonitorOptions) {
    this.startTime = Date.now();
    this.timeoutMs = options.timeoutMs;
    const threshold = options.thresholdPercent ?? 80;
    this.warningThresholdMs = this.timeoutMs * (threshold / 100);
  }

  onWarning(callback: () => Promise<void> | void) {
    this.onWarningCallback = callback;
  }

  check() {
    const elapsed = Date.now() - this.startTime;
    if (!this.warningEmitted && elapsed >= this.warningThresholdMs) {
      this.warningEmitted = true;
      if (this.onWarningCallback) {
        // We execute the callback but don't wait for it here to avoid blocking main loop
        // if it's async. However, usually this might trigger a flag or similar.
        void Promise.resolve(this.onWarningCallback()).catch(console.error);
      }
    }
  }

  getRemainingTime(): number {
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.timeoutMs - elapsed);
  }

  isTimeoutApproaching(): boolean {
    return this.warningEmitted;
  }
}

