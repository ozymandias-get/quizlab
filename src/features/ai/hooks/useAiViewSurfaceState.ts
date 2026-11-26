import { useAiLifecycleSettings } from '@features/ai/hooks/useAiLifecycleSettings'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Tab liveness for the AI panel, hoisted above the workspace / focus-mode split.
 *
 * Which tabs stay alive (the `maxAliveTabs` LRU) and what URL each tab was last
 * showing must survive a focus-mode switch. When that state lived inside the
 * panel component, entering focus mode unmounted it and every managed view had
 * to be rebuilt from scratch; keeping it here means a focus switch is purely a
 * geometry change.
 */

export interface AiTabUrlRequest {
  modelId: string
  url: string
  /** Monotonic id so the same URL can be requested again later. */
  nonce: number
}

export interface AiViewSurfaceState {
  /**
   * Tabs that currently own a managed view, most-recently-used first.
   *
   * Only tabs that can own a native `WebContentsView` are counted. API Chat
   * tabs are rendered by the same surface but have no native view, so they must
   * not take a warm-view slot away from a real site (see
   * {@link isViewlessAiTabModel}).
   */
  aliveTabIds: string[]
  showHome: boolean
  showHideHome: {
    show: () => void
    hide: () => void
  }
  /**
   * Tabs with no live `AiSession` mounted, because they are not in the alive set.
   *
   * Presentation-only: it explains why a tab renders as a cold placeholder in the
   * strip. Teardown is *not* driven from here — the eviction itself is already
   * expressed by a tab leaving {@link aliveTabIds}, which is what
   * `useManagedViewRetirement` reconciles against the main process.
   */
  coldTabIds: Set<string>
  recordTabUrl: (tabId: string, modelId: string, url: string) => void
  getRestoredUrl: (tabId: string, modelId: string) => string | undefined
  /**
   * One-shot navigation requests created by the home page. A session consumes
   * its request and loads the URL through the same attach/restore path used
   * when a tab is rebuilt, which keeps the request reliable for live, sleeping
   * and brand-new tabs alike.
   */
  tabUrlRequests: Record<string, AiTabUrlRequest | undefined>
  requestTabUrl: (tabId: string, modelId: string, url: string) => void
  clearTabUrlRequest: (tabId: string) => void
}

interface UseAiViewSurfaceStateOptions {
  tabIds: string[]
  activeTabId: string | null
  aiViewRequestNonce: number
  /**
   * Tabs that never own a native view — currently API Chat.
   *
   * They are transparent to the warm-view budget: activating one must not
   * retire a site view, and two of them must not evict each other's site
   * either. They still get their own bounded LRU so an unbounded number of
   * mounted chat sessions cannot accumulate.
   */
  viewlessTabIds?: readonly string[]
}

/** Mirrors `AiSession`'s `isApiChat`: the one tab kind with no managed view. */
export function isViewlessAiTabModel(modelId: string): boolean {
  return modelId === 'api-chat'
}

export function useAiViewSurfaceState({
  tabIds,
  activeTabId,
  aiViewRequestNonce,
  viewlessTabIds = []
}: UseAiViewSurfaceStateOptions): AiViewSurfaceState {
  const { maxAliveTabs } = useAiLifecycleSettings()
  const viewlessKey = [...new Set(viewlessTabIds)].sort().join('\u0000')
  const viewlessSet = useMemo(
    () => new Set(viewlessKey === '' ? [] : viewlessKey.split('\u0000')),
    [viewlessKey]
  )
  const [aliveTabIds, setAliveTabIds] = useState<string[]>(() =>
    activeTabId && !viewlessSet.has(activeTabId) ? [activeTabId] : []
  )
  const [showHome, setShowHome] = useState(() => tabIds.length === 0 || !activeTabId)
  const [tabUrlRequests, setTabUrlRequests] = useState<Record<string, AiTabUrlRequest | undefined>>(
    {}
  )
  const requestNonceRef = useRef(0)
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

  const requestTabUrl = useCallback((tabId: string, modelId: string, url: string) => {
    requestNonceRef.current += 1
    const nonce = requestNonceRef.current
    setTabUrlRequests((current) => ({ ...current, [tabId]: { modelId, url, nonce } }))
  }, [])

  const clearTabUrlRequest = useCallback((tabId: string) => {
    setTabUrlRequests((current) => {
      if (!current[tabId]) return current
      const next = { ...current }
      delete next[tabId]
      return next
    })
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

  useEffect(() => {
    const currentTabIds = new Set(tabIds)
    setTabUrlRequests((current) => {
      const stale = Object.keys(current).filter((id) => !currentTabIds.has(id))
      if (stale.length === 0) return current
      const next = { ...current }
      for (const id of stale) delete next[id]
      return next
    })
  }, [tabIds])

  // Reconciles the alive set against the tab list on every change, including
  // when there is no active tab: a tab that was closed (or dropped by the LRU)
  // has to *leave* the set, otherwise its managed view would have no owner left
  // to retire it and would stay alive in the main process forever.
  //
  // Two independent budgets are applied in one recency-ordered pass:
  //
  // - site tabs, bounded by `maxAliveTabs` — these are the `WebContentsView`s
  //   the setting exists to bound;
  // - viewless tabs (API Chat), bounded by the same number so their React
  //   sessions cannot accumulate, but never competing with a site tab for a
  //   slot. Activating API Chat used to evict the least recent real site and
  //   destroy its live conversation for no memory saving whatsoever.
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

      let siteCount = 0
      let viewlessCount = 0
      const boundedNext = next.filter((id) => {
        if (viewlessSet.has(id)) {
          if (viewlessCount >= maxAliveTabs) return false
          viewlessCount += 1
          return true
        }
        if (siteCount >= maxAliveTabs) return false
        siteCount += 1
        return true
      })

      const isUnchanged =
        boundedNext.length === prev.length && boundedNext.every((id, index) => id === prev[index])

      // Tab metadata changes (a rename, for example) re-run this effect without
      // changing which sessions are alive; preserving the reference avoids a
      // redundant render.
      return isUnchanged ? prev : boundedNext
    })
  }, [activeTabId, maxAliveTabs, tabIds, viewlessSet])

  const show = useCallback(() => setShowHome(true), [])
  const hide = useCallback(() => setShowHome(false), [])
  const showHideHome = useMemo(() => ({ show, hide }), [show, hide])
  const coldTabIds = useMemo(() => {
    const aliveSet = new Set(aliveTabIds)
    // A viewless tab is never "cold" in the retire sense: it owns no native view
    // to evict, and the tab strip's sleeping glyph would be a lie for API Chat.
    return new Set(tabIds.filter((id) => !aliveSet.has(id) && !viewlessSet.has(id)))
  }, [tabIds, aliveTabIds, viewlessSet])

  return useMemo(
    () => ({
      aliveTabIds,
      showHome,
      showHideHome,
      coldTabIds,
      recordTabUrl,
      getRestoredUrl,
      tabUrlRequests,
      requestTabUrl,
      clearTabUrlRequest
    }),
    [
      aliveTabIds,
      showHome,
      showHideHome,
      coldTabIds,
      recordTabUrl,
      getRestoredUrl,
      tabUrlRequests,
      requestTabUrl,
      clearTabUrlRequest
    ]
  )
}
