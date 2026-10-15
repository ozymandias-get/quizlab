/**
 * The system clipboard round-trip an image send needs.
 *
 * Writing the image to the clipboard is the only way to reach a provider's
 * file input, which means the *user's* clipboard is borrowed for the duration of
 * the send and must be given back — exactly once, and even when a step in the
 * middle throws. Both halves of that contract (the retrying write, the
 * idempotent restore) live here so the pipeline only has to sequence them.
 */
import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'

import type { AiSendDiagnostics } from '../../model/types'
import { sleep } from '../aiSenderSupport'
import { nowMs, roundMs } from './sendDiagnostics'

const CLIPBOARD_COPY_ATTEMPTS = 3
/**
 * Grace period between the paste and the restore: the page reads the clipboard
 * asynchronously, so restoring immediately can blank the attachment the send
 * just produced.
 */
const RESTORE_SETTLE_MS = 700

export interface ClipboardRestore {
  /** Called once the paste actually reached the page, so the restore waits first. */
  markPasteCompleted(): void
  /**
   * Idempotent AND memoised: every call returns the same promise, so the
   * restore IPC runs exactly once. Callers can start it without awaiting
   * (off the critical path) and `await` it later from `finally`.
   */
  restore(): Promise<void>
  /** True until the real clipboard has been put back. */
  readonly pending: boolean
}

export function createClipboardRestore(diagnostics?: AiSendDiagnostics): ClipboardRestore {
  let pasteCompleted = false
  let restored = false
  let restorePromise: Promise<void> | null = null

  const runRestore = async () => {
    const startedAt = nowMs()
    try {
      if (pasteCompleted) await sleep(RESTORE_SETTLE_MS)
      await getElectronApi()?.restoreClipboard?.()
    } catch (restoreError) {
      reportSuppressedError('imageSend.clipboardRestore', { cause: restoreError })
    } finally {
      if (diagnostics) {
        diagnostics.timings.clipboardRestoreMs = roundMs(nowMs() - startedAt)
      }
      restored = true
    }
  }

  return {
    markPasteCompleted() {
      pasteCompleted = true
    },
    restore() {
      if (!restorePromise) {
        restorePromise = runRestore()
      }
      return restorePromise
    },
    get pending() {
      return !restored
    }
  }
}

/**
 * Writes the image to the clipboard, retrying a few times with a growing gap.
 * A provider page that is still attaching often drops the first write, so a
 * single refusal is not a failure.
 */
export async function copyImageToClipboardWithRetry(params: {
  copyImageToClipboard: (imageDataUrl: string) => Promise<boolean>
  imageDataUrl: string
  diagnostics: AiSendDiagnostics
}): Promise<boolean> {
  const { copyImageToClipboard, imageDataUrl, diagnostics } = params

  const clipboardStartedAt = nowMs()
  let copied = false
  for (let attempt = 0; attempt < CLIPBOARD_COPY_ATTEMPTS; attempt++) {
    try {
      copied = await copyImageToClipboard(imageDataUrl)
      if (copied) break
    } catch (clipboardError) {
      reportSuppressedError('imageSend.clipboardCopy', { cause: clipboardError })
    }
    if (attempt < CLIPBOARD_COPY_ATTEMPTS - 1) {
      await sleep(100 * (attempt + 1))
    }
  }
  diagnostics.timings.clipboardMs = roundMs(nowMs() - clipboardStartedAt)

  return copied
}
