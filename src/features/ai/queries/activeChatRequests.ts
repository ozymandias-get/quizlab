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

/**
 * Serializes concurrent sends per tab: a second send/regenerate/edit would
 * read-modify-write the same session concurrently and corrupt the transcript
 * order. Previously only the plain send path held this lock, so a rapid
 * Regenerate (or Send+Regenerate) on the same tab could run two requests in
 * parallel with last-write-wins on the reply.
 */
const inFlightSendsByTab = new Set<string>()

/**
 * Acquires the per-tab send lock. Returns true when acquired, false when
 * another send/regenerate/edit is already in flight for the tab.
 */
export function acquireChatSendLock(tabId: string): boolean {
  if (inFlightSendsByTab.has(tabId)) {
    return false
  }
  inFlightSendsByTab.add(tabId)
  return true
}

export function releaseChatSendLock(tabId: string): void {
  inFlightSendsByTab.delete(tabId)
}
