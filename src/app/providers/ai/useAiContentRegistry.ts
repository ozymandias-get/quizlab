import type { AiContentController } from '@shared-core/types/aiContent'

import { useCallback, useRef, useState } from 'react'

/**
 * Maps a tab id to the controller for its managed remote view.
 *
 * The controller itself is main-process backed; this registry only decides
 * which tab the automation / messaging consumers are allowed to talk to.
 */
export function useAiContentRegistry(activeTabId: string) {
  const contentControllersRef = useRef<Record<string, AiContentController>>({})
  const activeTabIdRef = useRef(activeTabId)
  const [activeContentCount, setActiveContentCount] = useState(0)

  // Keep ref in sync with latest activeTabId without triggering callback recreation
  activeTabIdRef.current = activeTabId

  const registerContent = useCallback(
    (id: string, controller: AiContentController | null, expected?: AiContentController) => {
      const prev = contentControllersRef.current
      if (prev[id] === controller) {
        return
      }

      if (controller === null) {
        if (!(id in prev)) {
          return
        }
        if (expected && prev[id] !== expected) {
          return
        }
        delete prev[id]
      } else {
        prev[id] = controller
      }
      setActiveContentCount(Object.keys(prev).length)
    },
    []
  )

  const getContentController = useCallback((tabId?: string): AiContentController | null => {
    return contentControllersRef.current[tabId || activeTabIdRef.current] || null
  }, [])

  return {
    registerContent,
    getContentController,
    hasActiveContent: activeContentCount > 0
  }
}
