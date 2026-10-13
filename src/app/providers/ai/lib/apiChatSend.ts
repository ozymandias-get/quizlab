import type { SendStage } from '@features/ai'
import { sendApiChatMessage } from '@features/ai'

import { queryClient } from '@app/providers/queryClient'
import { ensureErrorMessage } from '@shared/lib/errorUtils'

import type { AiSendResult } from '../types'

/**
 * Sends the current composer content of an api-chat tab through the
 * TanStack Query send mutation. Reads the store at fire time using the
 * tab id captured at request time, so a tab switch in between never
 * redirects the send to the wrong tab.
 *
 * ## Teslim belirsizliği kaybolmaz
 *
 * `sendApiChatMessage` kullanıcı mesajını **önce** oturuma yazar, kutuyu
 * temizler, sonra isteği atar. Bu yüzden bir hata dönse bile hedefte bir
 * kullanıcı mesajı duruyor olabilir: `errorReply` yazıldıysa mesaj
 * transcript'e girdi, `cancelled` ise istek başlatıldıktan sonra durdu.
 * İkisi de "güvenle tekrar gönderilebilir" **değildir** — tekrar aynı
 * içeriği ikinci bir kullanıcı mesajına dönüştürür.
 *
 * Bu yüzden sonuç yalnızca `{success, error}` değildir; `stage` de taşır ve
 * üst katmanın "otomatik tekrar" kararını besler. Ön uçuş hataları (boş
 * mesaj, oturum yok, eşzamanlı gönderim) hiçbir şey yazmadan başarısız
 * olur ve `not_started` döner.
 */
export async function flushApiChatSend(tabId: string): Promise<AiSendResult> {
  const { useChatUiStore } = await import('@features/ai')
  const uiState = useChatUiStore.getState()
  const text = uiState.inputValueByTab[tabId] || ''
  const images = uiState.attachmentsByTab[tabId] || []
  if (!text.trim() && images.length === 0) {
    return { success: false, error: 'empty_message', stage: 'not_started' }
  }
  try {
    const result = await sendApiChatMessage(queryClient, {
      tabId,
      text,
      images,
      model: uiState.selectedModelByTab[tabId],
      providerId: uiState.activeProviderByTab[tabId],
      generalPrompt: uiState.generalPrompt,
      memoryPrompt: uiState.memoryPrompt,
      characterPrompt: uiState.characterPrompt
    })
    if (!result.success) {
      // `errorReply` yazıldı → kullanıcı mesajı transcript'e girdi; istek
      // başlatıldıktan sonra iptal edildi → teslim belirsiz. İkisinde de
      // otomatik tekrar mükerrer mesaj üretir.
      const stage: SendStage = result.errorReply || result.cancelled ? 'uncertain' : 'not_started'
      return {
        success: false,
        error: ensureErrorMessage(result.error, 'send_failed'),
        stage
      }
    }
    return { success: true, stage: 'applied' }
  } catch (err) {
    // Ön uçuş doğrulaması: istek hiç atılmadı, hedefe dokunulmadı.
    return { success: false, error: ensureErrorMessage(err, 'send_failed'), stage: 'not_started' }
  }
}

/**
 * Debounces consecutive api-chat sends so a rapid text+image sequence is
 * bundled into a single request, while keeping the target tab fixed to the
 * one captured at request time. Resolves with the actual flush outcome so
 * awaiting callers can distinguish a delivered message from an API failure.
 *
 * Every caller gets its promise settled: when a newer call restarts the
 * debounce window the earlier callers are carried over (grouped per tab) and
 * resolved by the flush that eventually runs — never silently dropped.
 */
type SendTimeoutRef = { current: ReturnType<typeof setTimeout> | null }

interface PendingApiChatSend {
  tabId: string
  onResult?: (result: AiSendResult) => void
  resolve: (result: AiSendResult) => void
}

const pendingSendsByRef = new WeakMap<SendTimeoutRef, PendingApiChatSend[]>()

export function scheduleApiChatSend(
  tabId: string,
  timeoutRef: SendTimeoutRef,
  onResult?: (result: AiSendResult) => void
): Promise<AiSendResult> {
  return new Promise((resolve) => {
    const pending = pendingSendsByRef.get(timeoutRef) ?? []
    pending.push({ tabId, onResult, resolve })
    pendingSendsByRef.set(timeoutRef, pending)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null

      const waiting = pendingSendsByRef.get(timeoutRef) ?? []
      pendingSendsByRef.set(timeoutRef, [])

      // One flush per distinct tab: rapid sends to the same tab still merge
      // into a single request, and every waiter learns its own tab's outcome.
      const waitersByTab = new Map<string, PendingApiChatSend[]>()
      for (const entry of waiting) {
        const list = waitersByTab.get(entry.tabId)
        if (list) list.push(entry)
        else waitersByTab.set(entry.tabId, [entry])
      }

      void (async () => {
        for (const [flushTabId, waiters] of waitersByTab) {
          const result = await flushApiChatSend(flushTabId)
          for (const waiter of waiters) {
            waiter.onResult?.(result)
            waiter.resolve(result)
          }
        }
      })()
    }, 50)
  })
}

/**
 * Cancels a pending debounced send (e.g. provider unmount) and settles every
 * awaiting caller so no async chain is left hanging forever.
 *
 * İptal **hiçbir istek atılmadan**, debounce penceresinde gerçekleşir: flush
 * hiç çalışmadı, hazırlanan içerik hâlâ kutuda duruyor. Bu yüzden kod
 * `cancelled_before_send`'dır ve `cancelled`'dan ayrılır:
 *
 * - `cancelled_before_send` → hedef değişmedi; telafi hem güvenli hem
 *   **gereklidir** (yoksa hazırlanan görseller kullanıcı kutusunun içinde
 *   kalır ve bir sonraki denemede ikinci kez eklenir).
 * - `cancelled` → istek başlatıldıktan sonra durdu; teslim belirsiz, telafi
 *   yapılmaz ve otomatik tekrar engellenir.
 */
export function cancelScheduledApiChatSends(timeoutRef: SendTimeoutRef): void {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }
  const waiting = pendingSendsByRef.get(timeoutRef) ?? []
  pendingSendsByRef.set(timeoutRef, [])
  for (const waiter of waiting) {
    waiter.resolve({ success: false, error: 'cancelled_before_send', stage: 'not_started' })
  }
}

/**
 * Polls until an api-chat tab becomes active instead of sleeping a fixed
 * amount, so slow first mounts no longer drop the user's send with a
 * `webview_not_ready` error.
 */
export async function waitForApiChatTab(
  getActiveTabId: () => string,
  timeoutMs = 2000
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const tabId = getActiveTabId()
    if (tabId) return tabId
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return getActiveTabId() || null
}
