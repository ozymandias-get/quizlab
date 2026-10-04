import { useAiLifecycleSettings } from '@features/ai/hooks/useAiLifecycleSettings'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tab liveness for the AI panel, hoisted above the workspace / focus-mode split.
 *
 * Which tabs stay alive (the `maxAliveTabs` LRU) and what URL each tab was last
 * showing must survive a focus-mode switch. When that state lived inside the
 * panel component, entering focus mode unmounted it and every managed view had
 * to be rebuilt from scratch; keeping it here means a focus switch is purely a
 * geometry change.
 */

export interface AiViewSurfaceState {
  /** Tabs that currently own a managed view, most-recently-used first. */
  aliveTabIds: string[]
  showHome: boolean
  showHideHome: {
    show: () => void
    hide: () => void
  }
  /** Tabs whose managed view should be torn down. */
  coldTabIds: Set<string>
  recordTabUrl: (tabId: string, modelId: string, url: string) => void
  getRestoredUrl: (tabId: string, modelId: string) => string | undefined
}

interface UseAiViewSurfaceStateOptions {
  tabIds: string[]
  activeTabId: string | null
  aiViewRequestNonce: number
}

export function useAiViewSurfaceState({
  tabIds,
  activeTabId,
  aiViewRequestNonce
}: UseAiViewSurfaceStateOptions): AiViewSurfaceState {
  const { maxAliveTabs } = useAiLifecycleSettings()
  const [aliveTabIds, setAliveTabIds] = useState<string[]>(activeTabId ? [activeTabId] : [])
  const [showHome, setShowHome] = useState(() => tabIds.length === 0 || !activeTabId)
  const urlCacheRef = useRef<Record<string, { url: string; modelId: string }>>({})
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const recordTabUrl = useCallback((tabId: string, modelId: string, url: string) => {
    urlCacheRef.current[tabId] = { url, modelId }
  }, [])

  const getRestoredUrl = useCallback((tabId: string, modelId: string) => {
    const cached = urlCacheRef.current[tabId]
    if (!cached || cached.modelId !== modelId) return undefined
    return cached.url
  }, [])

  // Combine showHome logic into one effect to avoid a cascade: when
  // activeTabId/tabIds change, two effects would fire separately and cause two
  // renders.
  useEffect(() => {
    if (tabIds.length === 0 || !activeTabId) {
      setShowHome(true)
    } else if (aiViewRequestNonce > 0) {
      setShowHome(false)
    }
  }, [tabIds.length, activeTabId, aiViewRequestNonce])

  // Reconciles the alive set against the tab list on every change, including
  // when there is no active tab: a tab that was closed (or dropped by the LRU)
  // has to *leave* the set, otherwise its managed view would have no owner left
  // to retire it and would stay alive in the main process forever.
  useEffect(() => {
    if (!isMountedRef.current) return

    const currentTabIds = new Set(tabIds)

    setAliveTabIds((prev) => {
      const survivors = prev.filter((id) => currentTabIds.has(id))
      const next: string[] =
        activeTabId && currentTabIds.has(activeTabId)
          ? [activeTabId, ...survivors.filter((id) => id !== activeTabId)]
          : survivors

      const cache = urlCacheRef.current
      for (const id of Object.keys(cache)) {
        if (!currentTabIds.has(id)) {
          delete cache[id]
        }
      }

      const boundedNext = next.length > maxAliveTabs ? next.slice(0, maxAliveTabs) : next
      const isUnchanged =
        boundedNext.length === prev.length && boundedNext.every((id, index) => id === prev[index])

      // Tab metadata changes (a rename, for example) re-run this effect without
      // changing which sessions are alive; preserving the reference avoids a
      // redundant render.
      return isUnchanged ? prev : boundedNext
    })
  }, [activeTabId, maxAliveTabs, tabIds])

  const show = useCallback(() => setShowHome(true), [])
  const hide = useCallback(() => setShowHome(false), [])

  return {
    aliveTabIds,
    showHome,
    showHideHome: { show, hide },
    coldTabIds: new Set(tabIds.filter((id) => !aliveTabIds.includes(id))),
    recordTabUrl,
    getRestoredUrl
  }
}
