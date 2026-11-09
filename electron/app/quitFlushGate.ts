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

let resolvePending: (() => void) | null = null

/** The renderer answered that its pending writes are done. */
export function markQuitFlushComplete(): void {
  resolvePending?.()
  resolvePending = null
}

/** Asks the renderer to flush and waits for its answer, bounded by a timeout. */
export function waitForQuitFlush(
  window: BrowserWindow | null,
  timeoutMs = FLUSH_TIMEOUT_MS
): Promise<void> {
  if (!window || window.isDestroyed()) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const finish = (): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (resolvePending === finish) resolvePending = null
      resolve()
    }

    resolvePending = finish
    timer = setTimeout(finish, timeoutMs)

    try {
      window.webContents.send(IPC_CHANNELS.APP_FLUSH_PENDING_STATE)
    } catch {
      finish()
    }
  })
}
