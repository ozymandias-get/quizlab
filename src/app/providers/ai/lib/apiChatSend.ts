import { sendApiChatMessage } from '@features/ai/queries/useSendMessageMutation'

import { queryClient } from '@app/providers/queryClient'
import { ensureErrorMessage } from '@shared/lib/errorUtils'

import type { AiSendResult } from '../types'

/**
 * Sends the current composer content of an api-chat tab through the
 * TanStack Query send mutation. Reads the store at fire time using the
 * tab id captured at request time, so a tab switch in between never
 * redirects the send to the wrong tab.
 */
export async function flushApiChatSend(tabId: string): Promise<AiSendResult> {
  const { useChatUiStore } = await import('@features/ai/store/chatUiStore')
  const uiState = useChatUiStore.getState()
  const text = uiState.inputValueByTab[tabId] || ''
  const images = uiState.attachmentsByTab[tabId] || []
  if (!text.trim() && images.length === 0) {
    return { success: false, error: 'empty_message' }
  }
  try {
    await sendApiChatMessage(queryClient, {
      tabId,
      text,
      images,
      model: uiState.selectedModelByTab[tabId],
      providerId: uiState.activeProviderByTab[tabId],
      generalPrompt: uiState.generalPrompt,
      memoryPrompt: uiState.memoryPrompt,
      characterPrompt: uiState.characterPrompt
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: ensureErrorMessage(err, 'send_failed') }
  }
}

/**
 * Debounces consecutive api-chat sends so a rapid text+image sequence is
 * bundled into a single request, while keeping the target tab fixed to the
 * one captured at request time.
 */
export function scheduleApiChatSend(
  tabId: string,
  timeoutRef: { current: ReturnType<typeof setTimeout> | null },
  onResult?: (result: AiSendResult) => void
): void {
  if (timeoutRef.current) clearTimeout(timeoutRef.current)
  timeoutRef.current = setTimeout(() => {
    timeoutRef.current = null
    void flushApiChatSend(tabId).then(onResult)
  }, 50)
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
