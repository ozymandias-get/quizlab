/**
 * One decision for both ways the app can end: the window close button and
 * the application quit path. The renderer gets a bounded chance to flush, and
 * a failure is shown to the user instead of closing silently. Retry is a real
 * loop: if the second write fails too, the same choice comes back.
 */
import { type BrowserWindow, dialog } from 'electron'

import { Logger } from '../core/logger.js'
import { waitForQuitFlush } from './quitFlushGate.js'

const BUTTON_RETRY = 0
const BUTTON_QUIT_WITHOUT_SAVING = 1
const BUTTON_CANCEL = 2

/**
 * Resolves true when the app may close, false when the user cancelled.
 *
 * A missing or destroyed window has no renderer left to flush; closing is the
 * only meaningful answer there.
 */
export async function confirmQuitWithPendingWrites(window: BrowserWindow | null): Promise<boolean> {
  if (!window || window.isDestroyed()) return true

  for (;;) {
    const saved = await waitForQuitFlush(window)
    if (saved) return true

    let response: number
    try {
      ;({ response } = await dialog.showMessageBox(window, {
        type: 'warning',
        buttons: ['Retry', 'Quit without saving', 'Cancel'],
        defaultId: BUTTON_RETRY,
        cancelId: BUTTON_CANCEL,
        message: 'Some chat changes could not be saved.',
        detail: 'Retry saving, quit without the latest changes, or cancel closing the app?'
      }))
    } catch (error) {
      Logger.warn('[QuitFlow] The save-failure dialog could not be shown:', error)
      // No dialog available: do not trap the user in an unclosable app.
      return true
    }

    if (response === BUTTON_RETRY) continue
    if (response === BUTTON_QUIT_WITHOUT_SAVING) return true
    return false
  }
}
