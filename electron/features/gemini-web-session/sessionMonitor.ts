export class SessionMonitor {
  private timer: NodeJS.Timeout | null = null

  schedule(
    baseDelayMs: number,
    jitterPct: number,
    callback: () => Promise<void> | void
  ): void {
    this.stop()
    const delayMs = this.getJitteredDelay(baseDelayMs, jitterPct)
    this.timer = setTimeout(async () => {
      await callback()
    }, delayMs)
    this.timer.unref?.()
  }

  stop(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
  }

  private getJitteredDelay(baseDelay: number, jitterPct: number): number {
    const ratio = Math.max(0, Math.min(jitterPct, 95)) / 100
    const min = baseDelay * (1 - ratio)
    const max = baseDelay * (1 + ratio)
    return Math.floor(min + Math.random() * (max - min))
  }
}
