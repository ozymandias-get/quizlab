import { OcrQueue } from '@features/ocr/lib/ocrQueue'

import { describe, expect, it } from 'vitest'

describe('OcrQueue', () => {
  it('runs jobs sequentially with concurrency 1', async () => {
    const queue = new OcrQueue(1)
    const order: number[] = []

    const p1 = queue.enqueue(async () => {
      order.push(1)
      await new Promise<void>((r) => setTimeout(r, 10))
      order.push(2)
    }).promise

    const p2 = queue.enqueue(async () => {
      order.push(3)
    }).promise

    await Promise.all([p1, p2])
    expect(order).toEqual([1, 2, 3])
  })

  it('aborts queued job', async () => {
    const queue = new OcrQueue(1)
    let ran = false

    // Occupy queue
    const blocker = queue.enqueue(async () => {
      await new Promise<void>((r) => setTimeout(r, 30))
    })

    const target = queue.enqueue(async () => {
      ran = true
    })
    // Attach rejection handler before abort to avoid unhandled-rejection warning
    const caught = target.promise.catch((e) => e)
    target.abort()

    await blocker.promise
    await expect(caught).resolves.toBeInstanceOf(DOMException)
    expect(ran).toBe(false)
  })

  it('respects external abort signal', async () => {
    const queue = new OcrQueue(1)
    const controller = new AbortController()
    controller.abort()

    const job = queue.enqueue(async () => {}, controller.signal)
    await expect(job.promise).rejects.toThrow()
  })
})
