/**
 * The renderer → main clipboard write channel.
 *
 * The renderer is the only untrusted producer of clipboard content in the app
 * (a PDF's extracted text, a copied prompt), so the write is size-capped,
 * rate-limited per sender and stripped of control characters before it reaches
 * the system clipboard.
 */
import { clipboard } from 'electron'

import { success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { requireTrustedIpcSender } from '../ipcSecurity.js'
import { Logger } from '../logger.js'
import { sanitizeClipboardText } from './clipboard.js'

const { IPC_CHANNELS } = APP_CONFIG

const CLIPBOARD_THROTTLE_MS = 500
const CLIPBOARD_MAX_LENGTH = 100 * 1024

export function registerClipboardHandlers(): void {
  const lastClipboardWriteBySender = new Map<number, { time: number; text: string }>()

  registerIpcHandler(
    IPC_CHANNELS.COPY_TEXT,
    (event, text: string) => {
      try {
        if (typeof text !== 'string' || text.length === 0) return success(false)

        if (text.length > CLIPBOARD_MAX_LENGTH) {
          Logger.warn(`[Clipboard] Rejected oversized clipboard write: ${text.length} bytes`)
          return success(false)
        }

        const senderId = (event.sender as unknown as { id?: number })?.id ?? 0
        const now = Date.now()
        const last = lastClipboardWriteBySender.get(senderId)
        // Sadece aynı metin 500ms içinde tekrar kopyalanırsa throttle et;
        // farklı metinlerin hızlı kopyalanması (legit kullanıcı davranışı) engellenmemeli.
        if (last && now - last.time < CLIPBOARD_THROTTLE_MS && last.text === text) {
          Logger.warn('[Clipboard] Throttled rapid duplicate clipboard write')
          return success(false)
        }
        lastClipboardWriteBySender.set(senderId, { time: now, text })

        const sanitized = sanitizeClipboardText(text)

        clipboard.writeText(sanitized)
        Logger.info(`[Clipboard] Text copied: ${text.length} chars`)
        return success(true)
      } catch (error) {
        Logger.error('[Clipboard] Text copy failed:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )
}
