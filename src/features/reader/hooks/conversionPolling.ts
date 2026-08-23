import type { QuizLabConversionTask } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'

/**
 * Single polling state machine shared by initial conversion, retry and
 * reprocess paths.
 *
 * - Terminal states: completed / failed / cancelled / ipc-unavailable.
 * - IPC errors are NOT silently swallowed forever: they back off
   exponentially and surface as `ipc-unavailable` after N attempts, so a
 *   crashed main process never leaves the UI stuck on "processing".
 */
export type TaskPollOutcome = 'completed' | 'failed' | 'cancelled' | 'ipc-unavailable' | 'detached'

export const POLL_INTERVAL_MS = 900
const MAX_POLL_INTERVAL_MS = 8000
const MAX_CONSECUTIVE_ERRORS = 5

export interface TaskPollCallbacks {
  onTick?: (task: QuizLabConversionTask) => void
  onCompleted: (task: QuizLabConversionTask) => void | Promise<void>
  onError: (message: string) => void
}

function errorCode(task: QuizLabConversionTask): string | null {
  return (task.error as { code?: string } | undefined)?.code ?? null
}

export async function pollTaskUntilTerminal(
  taskId: string,
  callbacks: TaskPollCallbacks,
  signal: { aborted: boolean }
): Promise<TaskPollOutcome> {
  const api = getElectronApi()
  if (!api?.doclingConversion) return 'ipc-unavailable'
  let consecutiveErrors = 0

  while (!signal.aborted) {
    try {
      const cur = await api.doclingConversion.getStatus(taskId)
      consecutiveErrors = 0
      callbacks.onTick?.(cur)
      if (cur.status === 'completed') {
        await callbacks.onCompleted(cur)
        return 'completed'
      }
      if (cur.status === 'failed') {
        if (errorCode(cur) === 'cancelled') return 'cancelled'
        callbacks.onError(cur.error?.message ?? 'Conversion failed')
        return 'failed'
      }
    } catch {
      consecutiveErrors += 1
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        // Surface as terminal outcome so callers decide how to present it.
        return 'ipc-unavailable'
      }
    }
    // Linear wait normally; exponential back-off while erroring.
    const backoff =
      consecutiveErrors > 0
        ? Math.min(MAX_POLL_INTERVAL_MS, POLL_INTERVAL_MS * 2 ** consecutiveErrors)
        : POLL_INTERVAL_MS
    await new Promise<void>((resolve) => window.setTimeout(resolve, backoff))
  }
  return 'detached'
}
