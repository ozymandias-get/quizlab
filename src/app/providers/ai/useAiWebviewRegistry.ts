import { useCallback, useRef, useState } from 'react'
import type { WebviewController } from '@shared-core/types/webview'

export function useAiWebviewRegistry(activeTabId: string) {
  const webviewInstancesRef = useRef<Record<string, WebviewController>>({})
  const [activeWebviewCount, setActiveWebviewCount] = useState(0)

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

  const getWebviewInstance = useCallback(
    (tabId?: string): WebviewController | null => {
      return webviewInstancesRef.current[tabId || activeTabId] || null
    },
    [activeTabId]
  )

  return {
    registerWebview,
    getWebviewInstance,
    hasActiveWebview: activeWebviewCount > 0
  }
}
