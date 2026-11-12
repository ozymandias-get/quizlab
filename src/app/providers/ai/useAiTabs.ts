import { moveItemWithinList } from '@shared/lib/reorderList'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { areStoredTabsEqual, sanitizeStoredTabs } from './tabUtils'
import type { SetStoredValue, StoredAiTab, Tab } from './types'

interface UseAiTabsParams {
  isRegistryLoaded: boolean
  allAiIds: string[]
  defaultAiId: string
  defaultAiModel: string
  lastSelectedAI: string
  setLastSelectedAI: SetStoredValue<string>
  storedTabs: StoredAiTab[]
  setStoredTabs: SetStoredValue<StoredAiTab[]>
}

export function useAiTabs({
  isRegistryLoaded,
  allAiIds,
  defaultAiId,
  defaultAiModel,
  lastSelectedAI,
  setLastSelectedAI,
  storedTabs,
  setStoredTabs
}: UseAiTabsParams) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState('')
  const [isTabsInitialized, setIsTabsInitialized] = useState(false)
  const hasInitializedTabsRef = useRef(false)
  const tabsRef = useRef<Tab[]>([])
  const activeTabIdRef = useRef('')
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    tabsRef.current = tabs
    activeTabIdRef.current = activeTabId
  }, [tabs, activeTabId])

  useEffect(() => {
    if (!isRegistryLoaded || hasInitializedTabsRef.current || !isMountedRef.current) return

    const fallbackModelId = allAiIds.includes(defaultAiModel)
      ? defaultAiModel
      : allAiIds.includes(lastSelectedAI)
        ? lastSelectedAI
        : allAiIds.includes(defaultAiId)
          ? defaultAiId
          : allAiIds[0] || defaultAiId

    if (fallbackModelId !== lastSelectedAI) {
      setLastSelectedAI(fallbackModelId)
    }

    const sanitizedStored = sanitizeStoredTabs(storedTabs, allAiIds)
    if (!areStoredTabsEqual(sanitizedStored, storedTabs)) {
      setStoredTabs(sanitizedStored)
    }

    const nextTabs: Tab[] = sanitizedStored.map(({ id, modelId }) => ({ id, modelId }))
    setTabs(nextTabs)
    setActiveTabId(nextTabs.length > 0 ? nextTabs[0].id : '')
    setIsTabsInitialized(true)
    hasInitializedTabsRef.current = true
  }, [
    isRegistryLoaded,
    allAiIds,
    defaultAiId,
    lastSelectedAI,
    defaultAiModel,
    storedTabs,
    setStoredTabs,
    setLastSelectedAI
  ])

  /**
   * The strip is the source of truth while the app runs; the stored list is a
   * mirror of it, kept in the same order. Writing here (instead of in every
   * add/close/move action) means the persisted order can never drift from the
   * pills the user sees.
   */
  useEffect(() => {
    if (!hasInitializedTabsRef.current) return
    const nextStored: StoredAiTab[] = tabs.map(({ id, modelId }) => ({ id, modelId }))
    setStoredTabs((current) => (areStoredTabsEqual(current, nextStored) ? current : nextStored))
  }, [tabs, setStoredTabs])

  const setActiveTab = useCallback(
    (tabId: string) => {
      const targetTab = tabsRef.current.find((tab) => tab.id === tabId)
      if (!targetTab) return

      setActiveTabId((currentTabId) => (currentTabId === tabId ? currentTabId : tabId))
      setLastSelectedAI(targetTab.modelId)
    },
    [setLastSelectedAI]
  )

  const lastSelectedAIRef = useRef(lastSelectedAI)
  lastSelectedAIRef.current = lastSelectedAI

  const addTab = useCallback(
    (modelId: string) => {
      const selectedModel = allAiIds.includes(modelId)
        ? modelId
        : allAiIds.includes(defaultAiModel)
          ? defaultAiModel
          : lastSelectedAIRef.current
      const newTabId = crypto.randomUUID()
      setTabs((prev) => [...prev, { id: newTabId, modelId: selectedModel }])
      setActiveTabId(newTabId)
      setLastSelectedAI(selectedModel)
    },
    [allAiIds, defaultAiModel, setLastSelectedAI]
  )

  const closeTab = useCallback(
    (tabId: string) => {
      const currentTabs = tabsRef.current
      const tabToClose = currentTabs.find((tab) => tab.id === tabId)
      if (!tabToClose) return

      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId)
      setTabs(nextTabs)

      if (activeTabIdRef.current === tabId) {
        const nextActiveTab = nextTabs[nextTabs.length - 1]
        if (nextActiveTab) {
          setActiveTabId(nextActiveTab.id)
          setLastSelectedAI(nextActiveTab.modelId)
        } else {
          setActiveTabId('')
        }
      }
    },
    [setLastSelectedAI]
  )

  const moveTab = useCallback((tabId: string, targetId: string, placeAfter: boolean) => {
    setTabs((prev) => {
      const next = moveItemWithinList(prev, tabId, targetId, placeAfter)
      return next === prev ? prev : next
    })
  }, [])

  useEffect(() => {
    if (!isRegistryLoaded || allAiIds.length === 0) return

    const currentTabs = tabsRef.current
    if (currentTabs.length === 0) return

    const validIds = new Set(allAiIds)
    const fallbackModelId = validIds.has(defaultAiModel)
      ? defaultAiModel
      : allAiIds[0] || defaultAiId

    let tabsChanged = false
    const normalizedTabs = currentTabs.map((tab) => {
      if (validIds.has(tab.modelId)) return tab
      tabsChanged = true
      return { ...tab, modelId: fallbackModelId }
    })

    if (!tabsChanged) return

    setTabs(normalizedTabs)

    const activeTab = normalizedTabs.find((tab) => tab.id === activeTabIdRef.current)
    if (activeTab) {
      setLastSelectedAI(activeTab.modelId)
    }
  }, [isRegistryLoaded, allAiIds, defaultAiId, defaultAiModel, setLastSelectedAI])

  const currentAI = useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId)
    return activeTab?.modelId || lastSelectedAI
  }, [tabs, activeTabId, lastSelectedAI])

  return {
    tabs,
    activeTabId,
    currentAI,
    isTabsInitialized,
    addTab,
    closeTab,
    setActiveTab,
    moveTab
  }
}
