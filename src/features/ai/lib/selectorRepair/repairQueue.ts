/**
 * Per-hostname serialization for selector repairs.
 *
 * The send pipelines call `reportSelectorRepair` fire-and-forget so a user never
 * waits on a disk write. That freedom creates a lost-update hazard: two sends
 * finishing close together both read the same persisted repair counter, both
 * compute "1 → 2" and both write 2, so the streak never advances.
 *
 * A single promise chain per hostname closes that hole, because the second task
 * cannot start before the first has finished persisting. The queue is keyed by
 * hostname rather than global so a slow site (a big image upload) never delays
 * repairs for a different AI.
 *
 * The chain tail is deliberately never allowed to reject: a failed repair must
 * not poison the queue for every later send on that host.
 */
const repairQueues = new Map<string, Promise<unknown>>()

/**
 * Runs `task` after any repair already queued for `hostname`.
 *
 * @returns the task's own result. Rejections propagate to the caller so the
 * orchestrator can log them, but never to the queue tail.
 */
export function enqueueSelectorRepair<T>(hostname: string, task: () => Promise<T>): Promise<T> {
  const previous = repairQueues.get(hostname) ?? Promise.resolve()
  // `then(task, task)` so a task that somehow rejected still lets the next one
  // run instead of short-circuiting the chain.
  const next = previous.then(task, task)
  const tail = next.then(
    () => undefined,
    () => undefined
  )
  repairQueues.set(hostname, tail)

  // Drop the entry once the tail settles, but only if no newer task already
  // replaced it. Without the identity check a queued follow-up would leave a
  // permanently growing map behind.
  void tail.then(() => {
    if (repairQueues.get(hostname) === tail) {
      repairQueues.delete(hostname)
    }
  })

  return next
}

/**
 * Number of hostnames with an in-flight repair.
 *
 * Exposed so the queue can be asserted to release its entries; production code
 * has no use for it.
 */
export function getSelectorRepairQueueSize(): number {
  return repairQueues.size
}
