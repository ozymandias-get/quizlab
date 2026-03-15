import { useCallback, useMemo, useState } from 'react'
import type { WebviewController } from '@shared-core/types/webview'

export function useAiWebviewRegistry(activeTabId: string) {
  const [webviewInstances, setWebviewInstances] = useState<Record<string, WebviewController>>({})

  const registerWebview = useCallback((id: string, instance: WebviewController | null) => {
    setWebviewInstances((prev) => {
      if (prev[id] === instance) {
        return prev
      }

      if (instance === null) {
        if (!(id in prev)) {
          return prev
        }

        const { [id]: _, ...rest } = prev
        return rest
      }

      return { ...prev, [id]: instance }
    })
  }, [])

  const webviewInstance = useMemo(
    () => webviewInstances[activeTabId] || null,
    [webviewInstances, activeTabId]
  )

  return {
    registerWebview,
    webviewInstance
  }
}
