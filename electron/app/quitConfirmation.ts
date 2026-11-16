/**
 * One decision for every way the app can end or reload: the window close
 * button, an application quit, and a keyboard reload. The renderer gets a
 * bounded chance to flush, and a failure is shown to the user instead of
 * tearing the renderer down silently. Retry is a real loop: if the second
 * write fails too, the same choice comes back.
 *
 * All three callers share one `pendingDecision`. A reload followed immediately
 * by a close can no longer open two independent flush handshakes and two
 * dialogs whose answers contradict each other.
 */
import { type BrowserWindow, dialog } from 'electron'

import { Logger } from '../core/logger.js'
import { waitForQuitFlush } from './quitFlushGate.js'

export type PendingWritesAction = 'quit' | 'close' | 'reload'

interface DialogChoice {
  readonly buttons: readonly string[]
  readonly defaultId: number
  readonly cancelId: number
  readonly retry: number
  readonly proceed: number
  readonly detail: string
}

const CHOICES: Readonly<Record<PendingWritesAction, DialogChoice>> = {
  quit: {
    buttons: ['Retry', 'Quit without saving', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    retry: 0,
    proceed: 1,
    detail: 'Retry saving, quit without the latest changes, or cancel closing the app?'
  },
  close: {
    buttons: ['Retry', 'Close without saving', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    retry: 0,
    proceed: 1,
    detail: 'Retry saving, close without the latest changes, or cancel closing the window?'
  },
  reload: {
    buttons: ['Cancel', 'Reload without saving'],
    defaultId: 0,
    cancelId: 0,
    // A reload offers no retry button: the renderer that would answer a
    // second flush is the one about to be torn down by the reload.
    retry: -1,
    proceed: 1,
    detail:
      'Reloading now would lose the latest changes. Cancel and try again, or reload without them?'
  }
}

/**
 * The decision currently in progress.
 *
 * A second close click, a simultaneous app quit or a reload joins the same
 * decision instead of opening another dialog. A Cancel therefore stops every
 * caller waiting behind it.
 */
let pendingDecision: Promise<boolean> | null = null

/**
 * Resolves true when the caller may proceed, false when the user cancelled.
 *
 * A missing or destroyed window has no renderer left to flush; proceeding is
 * the only meaningful answer there.
 */
export function confirmPendingWrites(
  window: BrowserWindow | null,
  action: PendingWritesAction
): Promise<boolean> {
  if (!window || window.isDestroyed()) return Promise.resolve(true)
  if (pendingDecision) return pendingDecision

  pendingDecision = decide(window, action).finally(() => {
    pendingDecision = null
  })
  return pendingDecision
}

/** Backwards-compatible name for the quit path. */
export function confirmQuitWithPendingWrites(window: BrowserWindow | null): Promise<boolean> {
  return confirmPendingWrites(window, 'quit')
}

async function decide(window: BrowserWindow, action: PendingWritesAction): Promise<boolean> {
  const choice = CHOICES[action]
  for (;;) {
    const saved = await waitForQuitFlush(window)
    if (saved) return true

    let response: number
    try {
      ;({ response } = await dialog.showMessageBox(window, {
        type: 'warning',
        buttons: [...choice.buttons],
        defaultId: choice.defaultId,
        cancelId: choice.cancelId,
        message: 'Some chat changes could not be saved.',
        detail: choice.detail
      }))
    } catch (error) {
      Logger.warn('[QuitFlow] The save-failure dialog could not be shown:', error)
      // Never quit with unsaved changes just because the warning failed; the
      // caller stays open and can try again later.
      return false
    }

    if (response === choice.retry) continue
    if (response === choice.proceed) return true
    return false
  }
}
