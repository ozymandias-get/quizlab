/**
 * The main-process side of the controlled shutdown handshake.
 *
 * A window close or an app quit must not kill the renderer while its
 * IndexedDB write is still in flight. The main process asks the renderer to
 * flush, then waits a bounded time for the answer. A renderer that is gone,
 * crashed or too slow cannot block quitting forever.
 */
import type { BrowserWindow } from 'electron'

import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js'

const FLUSH_TIMEOUT_MS = 1500

/**
 * One resolver per flush request, keyed by the id sent to the renderer.
 *
 * A single global set let an answer from a timed-out request release the next
 * request: a slow renderer's late `true` could close the window before the new
 * flush had finished. The id makes every answer belong to exactly one request.
 */
const pendingWaiters = new Map<number, (saved: boolean) => void>()
let nextFlushRequestId = 1

/**
 * The renderer answered with the result of its pending writes.
 *
 * `false` means at least one save failed; the caller decides whether to quit
 * anyway or offer a retry. A missing id keeps the old broadcast behaviour for
 * callers that predate the request identity.
 */
export function markQuitFlushComplete(saved = true, requestId?: number): void {
  if (requestId !== undefined) {
    const resolve = pendingWaiters.get(requestId)
    if (!resolve) return
    pendingWaiters.delete(requestId)
    resolve(saved)
    return
  }

  for (const [id, resolve] of pendingWaiters) {
    pendingWaiters.delete(id)
    resolve(saved)
  }
}

/** Asks the renderer to flush and waits for its answer, bounded by a timeout. */
export function waitForQuitFlush(
  window: BrowserWindow | null,
  timeoutMs = FLUSH_TIMEOUT_MS
): Promise<boolean> {
  if (!window || window.isDestroyed()) return Promise.resolve(false)

  return new Promise<boolean>((resolve) => {
    const requestId = nextFlushRequestId++
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const finish = (saved = false): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      pendingWaiters.delete(requestId)
      resolve(saved)
    }

    pendingWaiters.set(requestId, finish)
    timer = setTimeout(finish, timeoutMs)

    try {
      window.webContents.send(IPC_CHANNELS.APP_FLUSH_PENDING_STATE, requestId)
    } catch {
      finish()
    }
  })
}
