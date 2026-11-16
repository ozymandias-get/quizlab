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
 * The decision currently in progress. Every caller joins it, but only the
 * request that is still current when the decision resolves may act on it.
 */
interface DecisionState {
  /** Latest action, so the dialog describes the action that will be performed. */
  action: PendingWritesAction
  /** Unique id of the latest request — action *type* alone cannot tell two
   * separate reloads apart (reload → close → reload). */
  requestId: number
}

interface DecisionResult {
  proceed: boolean
  winnerId: number
}

let pendingDecision: Promise<DecisionResult> | null = null
let pendingState: DecisionState | null = null
let nextRequestId = 1

/**
 * Resolves true only when the user allowed the write AND this exact request is
 * still the current one. A superseded caller gets false, which every caller
 * already treats as "do not perform the destructive action".
 *
 * A missing or destroyed window has no renderer left to flush; proceeding is
 * the only meaningful answer there.
 */
export function confirmPendingWrites(
  window: BrowserWindow | null,
  action: PendingWritesAction
): Promise<boolean> {
  if (!window || window.isDestroyed()) return Promise.resolve(true)

  const requestId = nextRequestId++
  if (!pendingDecision || !pendingState) {
    const state: DecisionState = { action, requestId }
    pendingState = state
    pendingDecision = decide(window, state).finally(() => {
      pendingDecision = null
      pendingState = null
    })
  } else {
    pendingState.action = action
    pendingState.requestId = requestId
  }

  const decision = pendingDecision
  return decision.then(({ proceed, winnerId }) => proceed && winnerId === requestId)
}

/** Backwards-compatible name for the quit path. */
export function confirmQuitWithPendingWrites(window: BrowserWindow | null): Promise<boolean> {
  return confirmPendingWrites(window, 'quit')
}

async function decide(window: BrowserWindow, state: DecisionState): Promise<DecisionResult> {
  let winnerId = state.requestId
  const winner = (proceed: boolean): DecisionResult => ({ proceed, winnerId })
  for (;;) {
    const saved = await waitForQuitFlush(window)
    if (saved) {
      winnerId = state.requestId
      return winner(true)
    }

    // Read the action at dialog time, not at decision creation: a close that
    // joined while the flush was in flight must show "Close without saving",
    // not the first caller's wording. Freeze the winner together with the
    // wording so a request joining while the modal dialog is open cannot turn
    // a "Reload without saving" consent into a quit.
    winnerId = state.requestId
    const choice = CHOICES[state.action]
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
      return winner(false)
    }

    if (response === choice.retry) continue
    if (response === choice.proceed) return winner(true)
    return winner(false)
  }
}
