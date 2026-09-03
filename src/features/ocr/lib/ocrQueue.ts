import { OCR_CONCURRENCY } from '../types'

type JobFn = (signal: AbortSignal) => Promise<void>

interface QueuedJob {
  id: string
  fn: JobFn
  signal: AbortSignal
  abortController: AbortController
  resolve: () => void
  reject: (e: unknown) => void
}

export class OcrQueue {
  private concurrency: number
  private running = 0
  private queue: QueuedJob[] = []
  private activeJobs = new Set<QueuedJob>()
  private idCounter = 0

  constructor(concurrency: number = OCR_CONCURRENCY) {
    this.concurrency = Math.max(1, concurrency)
  }

  enqueue(
    fn: JobFn,
    externalSignal?: AbortSignal
  ): { id: string; promise: Promise<void>; abort: () => void } {
    const id = `ocr-job-${Date.now()}-${this.idCounter++}`
    const controller = new AbortController()

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason)
      else
        externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), {
          once: true
        })
    }

    let resolve!: () => void
    let reject!: (e: unknown) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })

    const job: QueuedJob = {
      id,
      fn,
      signal: controller.signal,
      abortController: controller,
      resolve,
      reject
    }

    if (controller.signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return { id, promise, abort: () => controller.abort() }
    }

    this.queue.push(job)
    // Defer drain to next microtask so that `abort` is assigned before the job
    // function executes and captures it (avoids TDZ ReferenceError)
    queueMicrotask(() => this.drain())

    const abort = () => {
      if (controller.signal.aborted) return
      controller.abort(new DOMException('Aborted', 'AbortError'))
      const idx = this.queue.findIndex((j) => j.id === id)
      if (idx >= 0) {
        this.queue.splice(idx, 1)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      // If already running, the signal listener inside job.fn should handle termination.
      // We also proactively trigger slot release check via drain if job was the only runner and aborted handler will decrement.
    }

    return { id, promise, abort }
  }

  private drain(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()
      if (!job) break
      if (job.signal.aborted) {
        job.reject(new DOMException('Aborted', 'AbortError'))
        continue
      }
      this.running++
      this.activeJobs.add(job)
      void (async () => {
        try {
          await job.fn(job.signal)
          job.resolve()
        } catch (e) {
          job.reject(e)
        } finally {
          // abortAll() proactively rejects active jobs and resets `running` to 0.
          // Only decrement when this job is still tracked as active; otherwise
          // the slot was already released by abortAll and decrementing again
          // would drive the counter negative (-1) and corrupt concurrency.
          if (this.activeJobs.delete(job)) {
            this.running = Math.max(0, this.running - 1)
            queueMicrotask(() => this.drain())
          }
        }
      })()
    }
  }

  get pendingCount(): number {
    return this.queue.length
  }

  get runningCount(): number {
    return this.running
  }

  /**
   * Abort both queued and actively running jobs.
   * Running job's signal is aborted; its termination must be handled by the job's
   * own abort listener (e.g., tesseract worker termination). We also proactively
   * reject active jobs and reset the running counter to avoid queue stall when
   * the worker's abort handler is slow or never settles.
   */
  abortAll(): void {
    for (const job of this.queue) {
      job.abortController.abort(new DOMException('Cleared', 'AbortError'))
      job.reject(new DOMException('Cleared', 'AbortError'))
    }
    this.queue = []
    for (const job of this.activeJobs) {
      job.abortController.abort(new DOMException('Cancelled', 'AbortError'))
      // Proactively reject so callers don't hang if the worker ignores the signal
      try {
        job.reject(new DOMException('Cancelled', 'AbortError'))
      } catch {}
    }
    this.activeJobs.clear()
    this.running = 0
  }

  clear(): void {
    this.abortAll()
  }

  setConcurrency(n: number): void {
    this.concurrency = Math.max(1, n)
    this.drain()
  }
}

export const globalOcrQueue = new OcrQueue(OCR_CONCURRENCY)
