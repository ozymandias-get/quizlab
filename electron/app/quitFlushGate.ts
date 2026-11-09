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

const pendingWaiters = new Set<(saved: boolean) => void>()

/**
 * The renderer answered with the result of its pending writes.
 *
 * `false` means at least one save failed; the caller decides whether to quit
 * anyway or offer a retry.
 */
export function markQuitFlushComplete(saved = true): void {
  for (const resolve of pendingWaiters) resolve(saved)
  pendingWaiters.clear()
}

/** Asks the renderer to flush and waits for its answer, bounded by a timeout. */
export function waitForQuitFlush(
  window: BrowserWindow | null,
  timeoutMs = FLUSH_TIMEOUT_MS
): Promise<boolean> {
  if (!window || window.isDestroyed()) return Promise.resolve(false)

  return new Promise<boolean>((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const finish = (saved = false): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      pendingWaiters.delete(finish)
      resolve(saved)
    }

    // Concurrent close and quit paths may wait at the same time; each keeps
    // its own resolver and a single renderer answer releases all of them.
    pendingWaiters.add(finish)
    timer = setTimeout(finish, timeoutMs)

    try {
      window.webContents.send(IPC_CHANNELS.APP_FLUSH_PENDING_STATE)
    } catch {
      finish()
    }
  })
}
