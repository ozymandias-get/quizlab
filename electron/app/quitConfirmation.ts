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
 * The decision currently in progress.
 *
 * A second close click or a simultaneous app quit joins the same decision
 * instead of opening another dialog. A Cancel therefore stops every caller
 * waiting behind it.
 */
let pendingDecision: Promise<boolean> | null = null

/**
 * Resolves true when the app may close, false when the user cancelled.
 *
 * A missing or destroyed window has no renderer left to flush; closing is the
 * only meaningful answer there.
 */
export function confirmQuitWithPendingWrites(window: BrowserWindow | null): Promise<boolean> {
  if (!window || window.isDestroyed()) return Promise.resolve(true)
  if (pendingDecision) return pendingDecision

  pendingDecision = decide(window).finally(() => {
    pendingDecision = null
  })
  return pendingDecision
}

async function decide(window: BrowserWindow): Promise<boolean> {
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
      // Never quit with unsaved changes just because the warning failed; the
      // caller stays open and can try again later.
      return false
    }

    if (response === BUTTON_RETRY) continue
    if (response === BUTTON_QUIT_WITHOUT_SAVING) return true
    return false
  }
}
