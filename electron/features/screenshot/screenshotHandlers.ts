import { BrowserWindow, clipboard, nativeImage } from 'electron'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'

const MAX_CAPTURE_DIMENSION = 16384
const MAX_CAPTURE_AREA = 50 * 1024 * 1024 // ~50MP — prevents OOM via 16384x16384 (268MP) rect
const MAX_DATA_URL_LENGTH = 50 * 1024 * 1024 // 50 MB — prevents memory exhaustion via oversized base64 payloads

/** Minimum interval between successive screen captures (ms). */
const CAPTURE_THROTTLE_MS = 500
/** Maximum concurrent capture operations. */
const MAX_CONCURRENT_CAPTURES = 1

let lastCaptureTime = 0
let activeCaptures = 0

interface ClipboardSnapshot {
  text?: string
  html?: string
  image?: Electron.NativeImage
  /**
   * Ownership key of a send transaction. Every COPY_IMAGE of one send passes
   * the same scope: the first copy pushes the entry, later copies reuse it, and
   * exactly one RESTORE_CLIPBOARD(scope) releases it — even when a later copy
   * in the same send fails.
   */
  scope?: string
}

/**
 * Kapsam anahtarı deseni. Renderer tarafından üretilir; geçersiz anahtar
 * reddedilir ki bozuk bir sahiplik anahtarı yanlış girdiyi eşleştirmesin.
 */
const CLIPBOARD_SCOPE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Stack of clipboard snapshots taken right before COPY_IMAGE overwrites the
 * clipboard.
 *
 * Compatibility note: an unscoped restore pops the top entry and only writes
 * when it unwinds the whole stack (legacy nested-send behaviour). Scoped
 * restores remove exactly their own entry; the write is deferred until the
 * last entry unwinds so an active concurrent send keeps reading its own
 * clipboard image instead of the user's original content.
 */
const MAX_CLIPBOARD_SNAPSHOTS = 8
let clipboardSnapshots: ClipboardSnapshot[] = []

interface SnapshotReservation {
  /** True when this call pushed a new entry (and may discard it on failure). */
  pushed: boolean
  /** The scope's ownership entry, or null when no snapshot could be taken. */
  entry: ClipboardSnapshot | null
}

/**
 * Reserves the clipboard state for a COPY_IMAGE call.
 *
 * - Scoped calls reserve only once per scope: a multi-image send stays at one
 *   snapshot, so a single restore can hand the user's real clipboard back.
 * - While any entry exists the clipboard may hold an app-written temporary
 *   image; reading it would snapshot garbage. New entries reference the
 *   oldest entry's content instead — the one true pre-overwrite state.
 * - When no snapshot can be taken (stack full / read failure) the caller must
 *   refuse the copy: overwriting the clipboard without a way back loses the
 *   user's content.
 */
function reserveClipboardSnapshot(scope?: string): SnapshotReservation {
  try {
    if (scope) {
      const existing = clipboardSnapshots.find((snapshot) => snapshot.scope === scope)
      if (existing) return { pushed: false, entry: existing }
    }

    if (clipboardSnapshots.length >= MAX_CLIPBOARD_SNAPSHOTS) {
      Logger.warn('[Clipboard] Snapshot refused: stack is full')
      return { pushed: false, entry: null }
    }

    const source = clipboardSnapshots[0]
    let text: string | undefined
    let html: string | undefined
    let image: Electron.NativeImage | undefined

    if (source) {
      text = source.text
      html = source.html
      image = source.image
    } else {
      try {
        const t = clipboard.readText()
        if (t) text = t
      } catch {}
      try {
        const h = clipboard.readHTML()
        if (h) html = h
      } catch {}
      try {
        const img = clipboard.readImage()
        if (img && !img.isEmpty()) image = img
      } catch {}
    }

    const entry: ClipboardSnapshot = { text, html, image, scope }
    clipboardSnapshots.push(entry)
    return { pushed: true, entry }
  } catch (error) {
    Logger.warn('[Clipboard] Failed to snapshot clipboard:', error)
    return { pushed: false, entry: null }
  }
}

/**
 * Undoes a snapshot that was pushed for a write which then failed. Removes the
 * exact entry this call pushed — not `pop()` — so a concurrent handler that
 * pushed its own entry mid-retry cannot lose its snapshot.
 */
function discardClipboardSnapshot(entry: ClipboardSnapshot): void {
  const index = clipboardSnapshots.indexOf(entry)
  if (index !== -1) clipboardSnapshots.splice(index, 1)
}

function writeClipboardSnapshot(snapshot: ClipboardSnapshot): boolean {
  try {
    if (snapshot.image) {
      clipboard.writeImage(snapshot.image)
    } else if (snapshot.html) {
      clipboard.writeHTML(snapshot.html)
    } else if (snapshot.text !== undefined) {
      clipboard.writeText(snapshot.text)
    } else {
      clipboard.clear()
    }
    return true
  } catch (error) {
    Logger.error('[Clipboard] Failed to restore clipboard:', error)
    return false
  }
}

/**
 * Releases a snapshot reservation.
 *
 * - Scoped: removes the scope's own entry. The user's content is written back
 *   only when no other reservation remains — that is the true end of the
 *   clipboard borrow, and it keeps concurrent sends from clobbering each
 *   other's clipboard image mid-flight.
 * - Unscoped: legacy nested-send behaviour (pop top, write only when the
 *   stack becomes empty).
 *
 * Returns false when there was nothing to release, so callers can report the
 * failure instead of pretending the clipboard was restored.
 */
function restoreClipboard(scope?: string): boolean {
  if (scope) {
    const index = clipboardSnapshots.findIndex((snapshot) => snapshot.scope === scope)
    if (index === -1) return false
    const [snapshot] = clipboardSnapshots.splice(index, 1)
    if (clipboardSnapshots.length > 0) return true
    return writeClipboardSnapshot(snapshot)
  }

  const snapshot = clipboardSnapshots.pop()
  if (!snapshot) return false

  // Inner cycle of a nested send: leave the current content in place; the
  // outermost restore writes the user's original content back.
  if (clipboardSnapshots.length > 0) return true

  return writeClipboardSnapshot(snapshot)
}

export function registerScreenshotHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.CAPTURE_SCREEN,
    async (event, rect?) => {
      try {
        const now = Date.now()
        if (
          now - lastCaptureTime < CAPTURE_THROTTLE_MS ||
          activeCaptures >= MAX_CONCURRENT_CAPTURES
        ) {
          Logger.warn('[Screenshot] Capture rejected: rate-limited')
          return failure('internal_error', 'Capture rejected: rate-limited')
        }

        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win || win.isDestroyed()) return failure('internal_error', 'Window not available')

        if (rect) {
          if (
            typeof rect.x !== 'number' ||
            typeof rect.y !== 'number' ||
            typeof rect.width !== 'number' ||
            typeof rect.height !== 'number' ||
            !Number.isFinite(rect.x) ||
            !Number.isFinite(rect.y) ||
            !Number.isFinite(rect.width) ||
            !Number.isFinite(rect.height) ||
            rect.width <= 0 ||
            rect.height <= 0 ||
            rect.width > MAX_CAPTURE_DIMENSION ||
            rect.height > MAX_CAPTURE_DIMENSION ||
            rect.width * rect.height > MAX_CAPTURE_AREA
          ) {
            Logger.warn('[Screenshot] Capture rejected: invalid or out-of-bounds rect', {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            })
            return failure('internal_error', 'Invalid or out-of-bounds rect')
          }
        }

        lastCaptureTime = now
        activeCaptures++
        try {
          const image = await win.webContents.capturePage(rect)
          return success(image.toDataURL())
        } finally {
          activeCaptures--
        }
      } catch (error) {
        Logger.error('[Screenshot] Capture failed:', error)
        return failure('internal_error', (error as Error).message)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.COPY_IMAGE,
    async (_event, dataUrl: string, scope?: string) => {
      // Declared outside the try so the finally below can unwind a snapshot that
      // was taken for a write which never landed.
      let pushedEntry: ClipboardSnapshot | null = null
      let writeSucceeded = false
      const hasValidScope =
        scope === undefined || (typeof scope === 'string' && CLIPBOARD_SCOPE_PATTERN.test(scope))

      try {
        if (!dataUrl?.startsWith('data:image/')) return success(false)
        if (!hasValidScope) {
          Logger.warn('[Clipboard] Copy rejected: invalid scope')
          return success(false)
        }
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          Logger.warn('[Clipboard] Copy rejected: data URL exceeds size limit')
          return success(false)
        }

        if (dataUrl.length > 1024 * 1024) {
          Logger.info(
            `[Clipboard] Decoding large image: ${(dataUrl.length / 1024 / 1024).toFixed(1)} MB Base64`
          )
          await new Promise<void>((resolve) => setImmediate(resolve))
        }

        let image = nativeImage.createFromDataURL(dataUrl)

        // Chromium's GURL constructor has a ~2MB limit (kMaxURLChars = 2*1024*1024).
        // High-res screenshots and full-page renders larger than 2MB cause createFromDataURL
        // to return an empty image. Fallback: decode base64 to Buffer and use createFromBuffer.
        if (image.isEmpty() && typeof nativeImage.createFromBuffer === 'function') {
          try {
            const commaIndex = dataUrl.indexOf(',')
            if (commaIndex !== -1) {
              const base64Str = dataUrl.slice(commaIndex + 1)
              const buffer = Buffer.from(base64Str, 'base64')
              if (buffer.length > 0) {
                const bufferImage = nativeImage.createFromBuffer(buffer)
                if (bufferImage && !bufferImage.isEmpty()) {
                  image = bufferImage
                }
              }
            }
          } catch (err) {
            Logger.warn('[Clipboard] Buffer fallback decoding failed:', err)
          }
        }

        if (image.isEmpty()) return success(false)

        if (typeof image.getSize === 'function') {
          const imgSize = image.getSize()
          Logger.info(`[Clipboard] Image ready for clipboard: ${imgSize.width}x${imgSize.height}`)
        }

        const reservation = reserveClipboardSnapshot(scope)
        if (!reservation.entry) {
          // Geri yükleme garantisi verilemiyorsa pano ezilmez: kullanıcının
          // panosunu geri dönüşü olmadan kaybetmek "gönderim başarısız"dan
          // daha ağır bir hatadır.
          Logger.warn('[Clipboard] Copy rejected: no snapshot available')
          return success(false)
        }
        pushedEntry = reservation.pushed ? reservation.entry : null

        // Windows clipboard locks can be transiently held by other apps
        // (Clipboard history, Office, etc.). Retry with short backoff.
        let lastError: unknown = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            clipboard.writeImage(image)
            writeSucceeded = true
            break
          } catch (err) {
            lastError = err
            if (attempt < 2) {
              await new Promise<void>((resolve) => setTimeout(resolve, 50 * (attempt + 1)))
            }
          }
        }

        if (!writeSucceeded) {
          Logger.error('[Clipboard] Copy failed after retries:', lastError)
          return success(false)
        }

        // Do not mutate the NativeImage after writeImage – on Linux the
        // object is reference-counted and the clipboard may still hold a
        // reference. Resizing would corrupt the clipboard contents. Let GC
        // handle the temporary image.

        return success(true)
      } catch (error) {
        Logger.error('[Clipboard] Copy failed:', error)
        return success(false)
      } finally {
        // Kapsamsız (legacy) akışta başarısız yazımdan sonra bu çağrının
        // açtığı snapshot bırakılır; aksi halde hiç geri yüklenmeyecek bir
        // girdi stack'i doldurur. Kapsamlı akışta girdi sahipliği korunur:
        // pipeline'ın `finally`'si restore(scope) ile onu zaten çözer ve
        // panoya hiç dokunulmamış olsa bile sahiplik defteri temiz kapanır.
        if (pushedEntry && !writeSucceeded && !scope) {
          discardClipboardSnapshot(pushedEntry)
        }
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.RESTORE_CLIPBOARD,
    (_event, scope?: string) => {
      if (
        scope !== undefined &&
        (typeof scope !== 'string' || !CLIPBOARD_SCOPE_PATTERN.test(scope))
      ) {
        Logger.warn('[Clipboard] Restore rejected: invalid scope')
        return success(false)
      }
      return success(restoreClipboard(scope))
    },
    requireTrustedIpcSender,
    success(false)
  )
}
