import type { WebContents } from 'electron'

import { AI_REGISTRY } from '../ai/aiManager.js'

/**
 * Keeps one provider keyboard binding out of the embedded guest page.
 *
 * ChatGPT's web app binds `Ctrl+Shift+S` to its own sidebar toggle. QuizLab has
 * no app-level shortcut on that combination: its crop screenshot is an
 * accelerator on the PDF *context menu* (`electron/features/pdf/pdfHandlers.ts`)
 * and the PDF viewer lives in the main renderer, never in a managed
 * `WebContentsView`. So while a provider view has focus, Chromium delivers the
 * keystroke straight to the guest page, ChatGPT acts on it, and the app never
 * sees anything.
 *
 * The guard therefore suppresses exactly that one combination on the one
 * provider that binds it. Everything else — the composer, copy/paste, devtools
 * chords, the provider's other shortcuts — is passed through untouched.
 */

/** Partition of the built-in ChatGPT provider, resolved from registry state. */
const CHATGPT_PARTITION: string | undefined = AI_REGISTRY.chatgpt?.partition

/** Whether a managed view's partition belongs to the ChatGPT provider. */
export function isChatGptViewPartition(partition: string): boolean {
  return CHATGPT_PARTITION !== undefined && partition === CHATGPT_PARTITION
}

type ShortcutInput = Pick<Electron.Input, 'type' | 'key' | 'control' | 'shift' | 'alt' | 'meta'>

/**
 * Whether `input` is ChatGPT's sidebar toggle.
 *
 * Deliberately strict: exactly Ctrl+Shift+S, no Alt/Meta, key-down only. The
 * platform gate lives in {@link installChatGptShortcutGuard} because on macOS
 * the same chord is Cmd+Shift+S, which the existing accelerator contract leaves
 * alone.
 */
export function isChatGptSidebarShortcut(input: ShortcutInput): boolean {
  if (input.type !== 'keyDown' && input.type !== 'rawKeyDown') return false
  if (!input.control || !input.shift) return false
  if (input.alt || input.meta) return false
  return input.key?.toLowerCase() === 's'
}

/**
 * Disposers by `WebContents`, so a view can never accumulate a second guard.
 *
 * Weak keys: the listener belongs to the guest WebContents, so once that view is
 * torn down there is nothing left to keep alive.
 */
const guards = new WeakMap<WebContents, () => void>()

/**
 * Stops ChatGPT's sidebar shortcut from reaching the guest page.
 *
 * Returns a disposer, and is idempotent per `WebContents`: a second call hands
 * back the existing disposer instead of registering another listener. That is
 * what makes a re-attach onto the same view, or any future repeated call site,
 * safe.
 */
export function installChatGptShortcutGuard(
  webContents: WebContents,
  platform: NodeJS.Platform = process.platform
): () => void {
  // macOS keeps its existing contract: Cmd+Shift+S is not this guard's business.
  if (platform === 'darwin') return () => {}

  const installed = guards.get(webContents)
  if (installed) return installed

  const onBeforeInput = (event: Electron.Event, input: Electron.Input): void => {
    if (!isChatGptSidebarShortcut(input)) return
    // Cancelling the keydown is what stops the page handler from seeing the
    // chord; the matching keyup still arrives and no other listener acts on it.
    event.preventDefault()
  }

  webContents.on('before-input-event', onBeforeInput)

  const dispose = (): void => {
    if (guards.get(webContents) !== dispose) return
    guards.delete(webContents)
    // A destroyed WebContents has already dropped its listeners.
    if (webContents.isDestroyed()) return
    webContents.removeListener('before-input-event', onBeforeInput)
  }

  guards.set(webContents, dispose)
  return dispose
}
