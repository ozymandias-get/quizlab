import type { AiViewEvent } from '@shared-core/types/aiView'

import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'

/**
 * Single fan-in point for managed-view events.
 *
 * Every `WebContentsView` reports through one IPC channel, so the renderer
 * keeps exactly one `ipcRenderer` subscription no matter how many tabs are
 * alive. Controllers register here and filter by their own view id and
 * generation.
 */

type Handler = (event: AiViewEvent) => void

const handlers = new Set<Handler>()
let unsubscribe: (() => void) | null = null

function dispatch(event: AiViewEvent): void {
  for (const handler of handlers) {
    try {
      handler(event)
    } catch (error) {
      reportSuppressedError('aiView.eventHandler', { cause: error })
    }
  }
}

/**
 * Returns the managed-view IPC surface, or `null` when the bridge is
 * unavailable in browser development mode.
 */
export function getAiViewClient() {
  return getElectronApi()?.aiView ?? null
}

export function subscribeAiViewEvents(handler: Handler): () => void {
  handlers.add(handler)

  if (!unsubscribe) {
    const client = getAiViewClient()
    if (!client) {
      handlers.delete(handler)
      return () => handlers.delete(handler)
    }
    unsubscribe = client.onEvent(dispatch)
  }

  return () => {
    handlers.delete(handler)
    if (handlers.size === 0 && unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }
}
