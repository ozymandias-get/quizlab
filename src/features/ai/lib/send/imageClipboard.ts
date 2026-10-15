/**
 * The system clipboard round-trip an image send needs.
 *
 * Writing the image to the clipboard is the only way to reach a provider's
 * file input, which means the *user's* clipboard is borrowed for the duration of
 * the send and must be given back — exactly once, and even when a step in the
 * middle throws. Both halves of that contract (the retrying write, the
 * idempotent restore) live here so the pipeline only has to sequence them.
 *
 * Ownership: every send gets a `scopeId`. All image copies of one send carry
 * it, so the main process takes exactly ONE snapshot per send (a multi-image
 * bulk send used to leave N−1 orphaned snapshots behind) and the matching
 * `restore(scopeId)` releases exactly this send's snapshot — concurrent sends
 * on other tabs cannot consume each other's.
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

let clipboardScopeCounter = 0

/** Unique, bounded ownership key (validated again in the main process). */
function nextClipboardScopeId(): string {
  clipboardScopeCounter = (clipboardScopeCounter + 1) % 1_000_000
  return `send-${Date.now().toString(36)}-${clipboardScopeCounter.toString(36)}`
}

export interface ClipboardRestore {
  /** Bu gönderime ait pano snapshot'ının sahiplik anahtarı. */
  readonly scopeId: string
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
  const scopeId = nextClipboardScopeId()
  let pasteCompleted = false
  let restored = false
  let restorePromise: Promise<void> | null = null

  const recordRestoreFailure = (cause: unknown) => {
    if (diagnostics) {
      diagnostics.clipboardRestoreFailed = true
    }
    reportSuppressedError('imageSend.clipboardRestore', { cause })
  }

  const runRestore = async () => {
    const startedAt = nowMs()
    try {
      if (pasteCompleted) await sleep(RESTORE_SETTLE_MS)
      const api = getElectronApi()
      if (api?.restoreClipboard) {
        // `false` = bu kapsam için snapshot yok (bozuk/çalınmış sahiplik) —
        // sessizce "geri yüklendi" sayılmaz.
        const restoredOk = await api.restoreClipboard(scopeId)
        if (restoredOk === false) {
          recordRestoreFailure(
            new Error('clipboard restore reported no snapshot for this send scope')
          )
        }
      }
    } catch (restoreError) {
      recordRestoreFailure(restoreError)
    } finally {
      if (diagnostics) {
        diagnostics.timings.clipboardRestoreMs = roundMs(nowMs() - startedAt)
      }
      restored = true
    }
  }

  return {
    scopeId,
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
 *
 * `scope` ties every copy of one send to the same clipboard snapshot.
 */
export async function copyImageToClipboardWithRetry(params: {
  copyImageToClipboard: (imageDataUrl: string, scope?: string) => Promise<boolean>
  imageDataUrl: string
  scope?: string
  diagnostics: AiSendDiagnostics
}): Promise<boolean> {
  const { copyImageToClipboard, imageDataUrl, scope, diagnostics } = params

  const clipboardStartedAt = nowMs()
  let copied = false
  for (let attempt = 0; attempt < CLIPBOARD_COPY_ATTEMPTS; attempt++) {
    try {
      copied = await copyImageToClipboard(imageDataUrl, scope)
      if (copied) break
    } catch (clipboardError) {
      reportSuppressedError('imageSend.clipboardCopy', { cause: clipboardError })
    }
    if (attempt < CLIPBOARD_COPY_ATTEMPTS - 1) {
      await sleep(100 * (attempt + 1))
    }
  }
  // Biriken süre: çoklu görselde her kopya eklenir; kapsam başına tek satır
  // tutmak son kopyanın süresini "toplam" gibi gösterme hatasına yol açardı.
  diagnostics.timings.clipboardMs = roundMs(
    (diagnostics.timings.clipboardMs ?? 0) + (nowMs() - clipboardStartedAt)
  )

  return copied
}
