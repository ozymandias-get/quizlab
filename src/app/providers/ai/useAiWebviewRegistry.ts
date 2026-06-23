import type { WebviewController } from '@shared-core/types/webview'

import { useCallback, useRef, useState } from 'react'

export function useAiWebviewRegistry(activeTabId: string) {
  const webviewInstancesRef = useRef<Record<string, WebviewController>>({})
  const activeTabIdRef = useRef(activeTabId)
  const [activeWebviewCount, setActiveWebviewCount] = useState(0)

  // Keep ref in sync with latest activeTabId without triggering callback recreation
  activeTabIdRef.current = activeTabId

  const registerWebview = useCallback((id: string, instance: WebviewController | null) => {
    const prev = webviewInstancesRef.current
    if (prev[id] === instance) {
      return
    }

    if (instance === null) {
      if (!(id in prev)) {
        return
      }
      delete prev[id]
    } else {
      prev[id] = instance
    }
    setActiveWebviewCount(Object.keys(prev).length)
  }, [])

  const getWebviewInstance = useCallback((tabId?: string): WebviewController | null => {
    return webviewInstancesRef.current[tabId || activeTabIdRef.current] || null
  }, [])

  return {
    registerWebview,
    getWebviewInstance,
    hasActiveWebview: activeWebviewCount > 0
  }
}
