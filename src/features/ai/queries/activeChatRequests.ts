import { generateId } from '../store/apiChatSessionUtils'

/**
 * Per-tab in-flight chat request ids. The Stop button aborts exactly the
 * request belonging to its tab; concurrent sends from other tabs are never
 * affected (the main process keys AbortControllers by requestId).
 */
const activeRequestIdsByTab = new Map<string, string>()

/** Registers a new in-flight request for the tab and returns its id. */
export function beginChatRequest(tabId: string): string {
  const requestId = generateId('req')
  activeRequestIdsByTab.set(tabId, requestId)
  return requestId
}

export function endChatRequest(tabId: string, requestId: string): void {
  if (activeRequestIdsByTab.get(tabId) === requestId) {
    activeRequestIdsByTab.delete(tabId)
  }
}

export function getActiveChatRequestId(tabId: string): string | undefined {
  return activeRequestIdsByTab.get(tabId)
}
