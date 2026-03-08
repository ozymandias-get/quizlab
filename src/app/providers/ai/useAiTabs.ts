import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { arePinnedTabsEqual, normalizeTitle, sanitizePinnedTabs } from './tabUtils'
import type { PinnedTabStorage, SetStoredValue, Tab } from './types'

interface UseAiTabsParams {
    isRegistryLoaded: boolean
    allAiIds: string[]
    defaultAiId: string
    defaultAiModel: string
    lastSelectedAI: string
    setLastSelectedAI: SetStoredValue<string>
    pinnedTabs: PinnedTabStorage[]
    setPinnedTabs: SetStoredValue<PinnedTabStorage[]>
}

export function useAiTabs({
    isRegistryLoaded,
    allAiIds,
    defaultAiId,
    defaultAiModel,
    lastSelectedAI,
    setLastSelectedAI,
    pinnedTabs,
    setPinnedTabs
}: UseAiTabsParams) {
    const [tabs, setTabs] = useState<Tab[]>([])
    const [activeTabId, setActiveTabId] = useState('')
    const [isTabsInitialized, setIsTabsInitialized] = useState(false)
    const hasInitializedTabsRef = useRef(false)
    const tabsRef = useRef<Tab[]>([])
    const activeTabIdRef = useRef('')

    useEffect(() => {
        tabsRef.current = tabs
        activeTabIdRef.current = activeTabId
    }, [tabs, activeTabId])

    useEffect(() => {
        if (!isRegistryLoaded || hasInitializedTabsRef.current) return

        const fallbackModelId = allAiIds.includes(defaultAiModel)
            ? defaultAiModel
            : (allAiIds.includes(lastSelectedAI)
                ? lastSelectedAI
                : (allAiIds.includes(defaultAiId) ? defaultAiId : (allAiIds[0] || defaultAiId)))

        if (fallbackModelId !== lastSelectedAI) {
            setLastSelectedAI(fallbackModelId)
        }

        const sanitizedPinned = sanitizePinnedTabs(pinnedTabs, allAiIds)
        if (!arePinnedTabsEqual(sanitizedPinned, pinnedTabs)) {
            setPinnedTabs(sanitizedPinned)
        }

        const nextTabs: Tab[] = sanitizedPinned.map((tab) => ({ ...tab, pinned: true }))
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
        pinnedTabs,
        setPinnedTabs,
        setLastSelectedAI
    ])

    const setActiveTab = useCallback((tabId: string) => {
        const targetTab = tabsRef.current.find((tab) => tab.id === tabId)
        if (!targetTab) return

        setActiveTabId((currentTabId) => currentTabId === tabId ? currentTabId : tabId)
        setLastSelectedAI(targetTab.modelId)
    }, [setLastSelectedAI])

    const addTab = useCallback((modelId: string) => {
        const selectedModel = allAiIds.includes(modelId)
            ? modelId
            : (allAiIds.includes(defaultAiModel) ? defaultAiModel : lastSelectedAI)
        const newTabId = crypto.randomUUID()
        setTabs((prev) => [...prev, { id: newTabId, modelId: selectedModel }])
        setActiveTabId(newTabId)
        setLastSelectedAI(selectedModel)
    }, [allAiIds, defaultAiModel, lastSelectedAI, setLastSelectedAI])

    const closeTab = useCallback((tabId: string) => {
        const currentTabs = tabsRef.current
        const tabToClose = currentTabs.find((tab) => tab.id === tabId)
        if (!tabToClose) return

        const nextTabs = currentTabs.filter((tab) => tab.id !== tabId)
        setTabs(nextTabs)

        if (tabToClose.pinned) {
            setPinnedTabs((prev) => prev.filter((tab) => tab.id !== tabId))
        }

        if (activeTabIdRef.current === tabId) {
            const nextActiveTab = nextTabs[nextTabs.length - 1]
            if (nextActiveTab) {
                setActiveTabId(nextActiveTab.id)
                setLastSelectedAI(nextActiveTab.modelId)
            } else {
                setActiveTabId('')
            }
        }
    }, [setPinnedTabs, setLastSelectedAI])

    const renameTab = useCallback((tabId: string, title?: string) => {
        const normalizedTitle = normalizeTitle(title)
        setTabs((prev) => prev.map((tab) => (
            tab.id === tabId ? { ...tab, title: normalizedTitle } : tab
        )))
        setPinnedTabs((prev) => prev.map((tab) => (
            tab.id === tabId ? { ...tab, title: normalizedTitle } : tab
        )))
    }, [setPinnedTabs])

    const togglePinTab = useCallback((tabId: string) => {
        setTabs((prev) => {
            const targetTab = prev.find((tab) => tab.id === tabId)
            if (!targetTab) return prev

            const shouldPin = !targetTab.pinned
            const normalizedTitle = normalizeTitle(targetTab.title)

            setPinnedTabs((prevPinnedTabs) => {
                if (!shouldPin) {
                    return prevPinnedTabs.filter((tab) => tab.id !== tabId)
                }

                const filteredTabs = prevPinnedTabs.filter((tab) => tab.id !== tabId)
                return [...filteredTabs, { id: targetTab.id, modelId: targetTab.modelId, title: normalizedTitle }]
            })

            return prev.map((tab) => (
                tab.id === tabId ? { ...tab, pinned: shouldPin } : tab
            ))
        })
    }, [setPinnedTabs])

    useEffect(() => {
        if (!isRegistryLoaded || allAiIds.length === 0 || tabs.length === 0) return

        const validIds = new Set(allAiIds)
        const fallbackModelId = validIds.has(defaultAiModel)
            ? defaultAiModel
            : (allAiIds[0] || defaultAiId)

        let tabsChanged = false
        const normalizedTabs = tabs.map((tab) => {
            if (validIds.has(tab.modelId)) return tab
            tabsChanged = true
            return { ...tab, modelId: fallbackModelId }
        })

        if (!tabsChanged) return

        setTabs(normalizedTabs)

        const activeTab = normalizedTabs.find((tab) => tab.id === activeTabId)
        if (activeTab) {
            setLastSelectedAI(activeTab.modelId)
        }

        setPinnedTabs((prevPinned) => {
            let pinnedChanged = false
            const mapped = prevPinned.map((tab) => {
                if (validIds.has(tab.modelId)) return tab
                pinnedChanged = true
                return { ...tab, modelId: fallbackModelId }
            })
            return pinnedChanged ? mapped : prevPinned
        })
    }, [
        isRegistryLoaded,
        allAiIds,
        defaultAiId,
        tabs,
        activeTabId,
        defaultAiModel,
        setPinnedTabs,
        setLastSelectedAI
    ])

    const currentAI = useMemo(() => {
        const activeTab = tabs.find((tab) => tab.id === activeTabId)
        return activeTab?.modelId || lastSelectedAI
    }, [tabs, activeTabId, lastSelectedAI])

    const setCurrentAI = useCallback((id: string) => {
        setTabs((prev) => {
            const currentTabId = activeTabIdRef.current
            const activeTab = prev.find((tab) => tab.id === currentTabId)
            if (!activeTab) return prev

            const nextTabs = prev.map((tab) => (
                tab.id === currentTabId ? { ...tab, modelId: id } : tab
            ))

            if (activeTab.pinned) {
                setPinnedTabs((prevPinnedTabs) => prevPinnedTabs.map((tab) => (
                    tab.id === currentTabId
                        ? { ...tab, modelId: id, title: normalizeTitle(activeTab.title) }
                        : tab
                )))
            }

            return nextTabs
        })

        setLastSelectedAI(id)
    }, [setLastSelectedAI, setPinnedTabs])

    return {
        tabs,
        activeTabId,
        currentAI,
        isTabsInitialized,
        addTab,
        closeTab,
        setActiveTab,
        renameTab,
        togglePinTab,
        setCurrentAI
    }
}
