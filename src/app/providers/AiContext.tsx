import React, { createContext, useContext, useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage, useLocalStorageString, useLocalStorageBoolean } from '@shared/hooks'
import { useToast } from './ToastContext'
import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'
import { useAiSender } from '@features/ai'
import type { SendImageResult, SendTextResult } from '@features/ai'
import { useAiRegistry, useRefreshAiRegistry } from '@platform/electron/api/useAiApi'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'
import {
    DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
    GOOGLE_WEB_SESSION_REGISTRY_IDS
} from '@shared-core/constants/google-ai-web-apps'



const normalizeTitle = (title?: string): string | undefined => {
    const normalized = title?.trim()
    return normalized ? normalized : undefined
}

interface PinnedTabStorage {
    id: string;
    modelId: string;
    title?: string;
}

const sanitizePinnedTabs = (
    rawTabs: unknown,
    validModelIds: string[]
): PinnedTabStorage[] => {
    if (!Array.isArray(rawTabs)) return []

    const validModelSet = new Set(validModelIds)
    const seenIds = new Set<string>()
    const sanitized: PinnedTabStorage[] = []

    for (const rawTab of rawTabs) {
        if (!rawTab || typeof rawTab !== 'object') continue

        const maybeTab = rawTab as Partial<PinnedTabStorage>
        const id = typeof maybeTab.id === 'string' ? maybeTab.id.trim() : ''
        const modelId = typeof maybeTab.modelId === 'string' ? maybeTab.modelId.trim() : ''
        const title = normalizeTitle(maybeTab.title)

        if (!id || !modelId || !validModelSet.has(modelId) || seenIds.has(id)) continue
        seenIds.add(id)
        sanitized.push({ id, modelId, title })
    }

    return sanitized
}

const arePinnedTabsEqual = (a: PinnedTabStorage[], b: PinnedTabStorage[]) => {
    if (a.length !== b.length) return false

    for (let i = 0; i < a.length; i += 1) {
        if (
            a[i].id !== b[i].id ||
            a[i].modelId !== b[i].modelId ||
            normalizeTitle(a[i].title) !== normalizeTitle(b[i].title)
        ) {
            return false
        }
    }

    return true
}

const areStringArraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false
    }
    return true
}

export interface Tab {
    id: string;
    modelId: string;
    title?: string;
    pinned?: boolean;
}

interface AiContextType {
    isRegistryLoaded: boolean;
    chromeUserAgent: string;

    // Multi-tab support
    tabs: Tab[];
    activeTabId: string;
    addTab: (modelId: string) => void;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    renameTab: (tabId: string, title?: string) => void;
    togglePinTab: (tabId: string) => void;

    // Legacy support (mapped to active tab)
    currentAI: string;
    setCurrentAI: (id: string) => void;

    enabledModels: string[];
    setEnabledModels: (models: string[]) => void;
    defaultAiModel: string;
    setDefaultAiModel: (model: string) => void;
    aiSites: Record<string, AiPlatform>;
    autoSend: boolean;
    setAutoSend: (value: boolean) => void;
    toggleAutoSend: () => void;

    webviewInstance: WebviewController | null;
    registerWebview: (id: string, instance: WebviewController | null) => void;

    sendTextToAI: (text: string) => Promise<SendTextResult>;
    sendImageToAI: (imageData: string) => Promise<SendImageResult>;
    refreshRegistry: (force?: boolean) => Promise<void>;
    isTutorialActive: boolean;
    startTutorial: () => void;
    stopTutorial: () => void;
}

const AiContext = createContext<AiContextType | null>(null)

export function AiProvider({ children }: { children: React.ReactNode }) {
    const { showSuccess, showWarning } = useToast()

    // React Query Hooks
    const { data: registryData, isLoading, isError } = useAiRegistry()
    const { data: geminiWebStatus } = useGeminiWebStatus()
    const refreshMutation = useRefreshAiRegistry()

    const isRegistryLoaded = !isLoading && !isError && !!registryData

    // Webview Instances State (Map by Tab ID)
    const [webviewInstances, setWebviewInstances] = useState<Record<string, WebviewController>>({})
    const [isTutorialActive, setIsTutorialActive] = useState(false)
    const [isTabsInitialized, setIsTabsInitialized] = useState(false)
    const hasInitializedTabsRef = useRef(false)

    const AI_REGISTRY = (registryData?.aiRegistry || {}) as Record<string, AiPlatform>
    const DEFAULT_AI_ID = registryData?.defaultAiId || 'chatgpt'
    const GET_ALL_AI_IDS = registryData?.allAiIds || []

    const [lastSelectedAI, setLastSelectedAI] = useLocalStorageString(
        STORAGE_KEYS.LAST_SELECTED_AI,
        DEFAULT_AI_ID,
        GET_ALL_AI_IDS
    )
    const [enabledModels, setEnabledModels] = useLocalStorage<string[]>(
        STORAGE_KEYS.ENABLED_MODELS,
        GET_ALL_AI_IDS
    )
    const [bootstrappedSiteIds, setBootstrappedSiteIds] = useLocalStorage<string[]>(
        STORAGE_KEYS.BUILT_IN_SITE_BOOTSTRAP,
        []
    )
    const [enabledGoogleWebApps] = useLocalStorage<string[]>(
        'gwsEnabledApps',
        DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS
    )
    const [defaultAiModel, setDefaultAiModel] = useLocalStorageString(
        STORAGE_KEYS.DEFAULT_AI_MODEL,
        DEFAULT_AI_ID,
        GET_ALL_AI_IDS
    )
    const [autoSend, setAutoSend, toggleAutoSend] = useLocalStorageBoolean(
        STORAGE_KEYS.AUTO_SEND_ENABLED,
        false
    )
    const [pinnedTabs, setPinnedTabs] = useLocalStorage<PinnedTabStorage[]>(
        STORAGE_KEYS.PINNED_AI_TABS,
        []
    )

    // --- Tab Management ---
    const [tabs, setTabs] = useState<Tab[]>([])
    const [activeTabId, setActiveTabId] = useState<string>('')

    // Initialize tabs once after registry is loaded.
    useEffect(() => {
        if (!isRegistryLoaded || hasInitializedTabsRef.current) return

        const fallbackModelId = GET_ALL_AI_IDS.includes(defaultAiModel)
            ? defaultAiModel
            : (GET_ALL_AI_IDS.includes(lastSelectedAI)
                ? lastSelectedAI
                : (GET_ALL_AI_IDS.includes(DEFAULT_AI_ID) ? DEFAULT_AI_ID : (GET_ALL_AI_IDS[0] || DEFAULT_AI_ID)))

        if (fallbackModelId !== lastSelectedAI) {
            setLastSelectedAI(fallbackModelId)
        }

        const sanitizedPinned = sanitizePinnedTabs(pinnedTabs, GET_ALL_AI_IDS)
        if (!arePinnedTabsEqual(sanitizedPinned, pinnedTabs)) {
            setPinnedTabs(sanitizedPinned)
        }

        // Only load pinned tabs on startup. The Home Page is the default view.
        // Users will open new tabs from the Home Page or BottomBar.
        const nextTabs: Tab[] = sanitizedPinned.map((tab) => ({ ...tab, pinned: true }))

        setTabs(nextTabs)
        // If there are pinned tabs, select the first one; otherwise leave empty (home page will show)
        setActiveTabId(nextTabs.length > 0 ? nextTabs[0].id : '')
        setIsTabsInitialized(true)
        hasInitializedTabsRef.current = true
    }, [
        isRegistryLoaded,
        GET_ALL_AI_IDS,
        DEFAULT_AI_ID,
        lastSelectedAI,
        defaultAiModel,
        pinnedTabs,
        setPinnedTabs,
        setLastSelectedAI
    ])

    const setActiveTab = useCallback((tabId: string) => {
        const targetTab = tabs.find((tab) => tab.id === tabId)
        if (!targetTab) return

        setActiveTabId(tabId)
        setLastSelectedAI(targetTab.modelId)
    }, [tabs, setLastSelectedAI])

    const addTab = useCallback((modelId: string) => {
        const selectedModel = GET_ALL_AI_IDS.includes(modelId) ? modelId : (GET_ALL_AI_IDS.includes(defaultAiModel) ? defaultAiModel : lastSelectedAI)
        const newTabId = crypto.randomUUID()
        setTabs((prev) => [...prev, { id: newTabId, modelId: selectedModel }])
        setActiveTabId(newTabId)
        setLastSelectedAI(selectedModel)
    }, [GET_ALL_AI_IDS, lastSelectedAI, defaultAiModel, setLastSelectedAI])

    const closeTab = useCallback((tabId: string) => {
        const tabToClose = tabs.find((tab) => tab.id === tabId)
        if (!tabToClose) return

        const nextTabs = tabs.filter((tab) => tab.id !== tabId)
        setTabs(nextTabs)

        if (tabToClose.pinned) {
            setPinnedTabs((prev) => prev.filter((tab) => tab.id !== tabId))
        }

        if (activeTabId === tabId) {
            const nextActiveTab = nextTabs[nextTabs.length - 1]
            if (nextActiveTab) {
                setActiveTabId(nextActiveTab.id)
                setLastSelectedAI(nextActiveTab.modelId)
            } else {
                // No tabs left — home page will show
                setActiveTabId('')
            }
        }

        setWebviewInstances((prev) => {
            const newInstances = { ...prev }
            delete newInstances[tabId]
            return newInstances
        })
    }, [tabs, activeTabId, setPinnedTabs, setLastSelectedAI])

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
        if (!isRegistryLoaded || !geminiWebStatus || GET_ALL_AI_IDS.length === 0) return

        const validIds = new Set(GET_ALL_AI_IDS)
        const googleRegistryIdSet = new Set<string>(GOOGLE_WEB_SESSION_REGISTRY_IDS)
        const googleEnabledIds = (geminiWebStatus.enabled ? enabledGoogleWebApps : [])
            .filter((id) => validIds.has(id) && googleRegistryIdSet.has(id))
        const allowedIds = GET_ALL_AI_IDS.filter((id) => !googleRegistryIdSet.has(id) || googleEnabledIds.includes(id))
        const fallbackModelId = allowedIds.includes(defaultAiModel)
            ? defaultAiModel
            : (allowedIds[0] || GET_ALL_AI_IDS[0] || DEFAULT_AI_ID)

        const nextEnabled = [
            ...enabledModels.filter((id) => !googleRegistryIdSet.has(id) || googleEnabledIds.includes(id)),
            ...googleEnabledIds.filter((id) => !enabledModels.includes(id))
        ]
        const normalizedEnabled = nextEnabled.length > 0 ? nextEnabled : [fallbackModelId]

        if (!areStringArraysEqual(normalizedEnabled, enabledModels)) {
            setEnabledModels(normalizedEnabled)
        }
    }, [
        isRegistryLoaded,
        geminiWebStatus,
        GET_ALL_AI_IDS,
        DEFAULT_AI_ID,
        defaultAiModel,
        enabledModels,
        enabledGoogleWebApps,
        setEnabledModels
    ])

    // Computed currentAI based on active tab
    const currentAI = useMemo(() => {
        const activeTab = tabs.find((tab) => tab.id === activeTabId)
        return activeTab?.modelId || lastSelectedAI
    }, [tabs, activeTabId, lastSelectedAI])

    const setCurrentAI = useCallback((id: string) => {
        setTabs((prev) => {
            const activeTab = prev.find((tab) => tab.id === activeTabId)
            if (!activeTab) return prev

            const nextTabs = prev.map((tab) => (
                tab.id === activeTabId ? { ...tab, modelId: id } : tab
            ))

            if (activeTab.pinned) {
                setPinnedTabs((prevPinnedTabs) => prevPinnedTabs.map((tab) => (
                    tab.id === activeTabId
                        ? { ...tab, modelId: id, title: normalizeTitle(activeTab.title) }
                        : tab
                )))
            }

            return nextTabs
        })

        setLastSelectedAI(id)
    }, [activeTabId, setLastSelectedAI, setPinnedTabs])

    // Keep enabled/default/selected models valid when registry changes (e.g. Gemini web toggle off).
    useEffect(() => {
        if (!isRegistryLoaded || GET_ALL_AI_IDS.length === 0) return

        const validIds = new Set(GET_ALL_AI_IDS)
        const fallbackModelId = validIds.has(defaultAiModel)
            ? defaultAiModel
            : (GET_ALL_AI_IDS[0] || DEFAULT_AI_ID)
        const builtInSiteIds = Object.values(AI_REGISTRY)
            .filter((site) => site.isSite && !site.isCustom)
            .map((site) => site.id)
        const pendingBootstraps = builtInSiteIds.filter((id) => !bootstrappedSiteIds.includes(id))

        const filteredEnabled = enabledModels.filter((id) => validIds.has(id))
        const seededEnabled = [...filteredEnabled, ...pendingBootstraps.filter((id) => !filteredEnabled.includes(id))]
        const nextEnabled = seededEnabled.length > 0 ? seededEnabled : [fallbackModelId]

        if (!areStringArraysEqual(nextEnabled, enabledModels)) {
            setEnabledModels(nextEnabled)
        }

        if (pendingBootstraps.length > 0) {
            setBootstrappedSiteIds([...bootstrappedSiteIds, ...pendingBootstraps])
        }

        if (!validIds.has(defaultAiModel)) {
            setDefaultAiModel(nextEnabled[0] || fallbackModelId)
        }

        if (!validIds.has(lastSelectedAI)) {
            setLastSelectedAI(nextEnabled[0] || fallbackModelId)
        }
    }, [
        isRegistryLoaded,
        GET_ALL_AI_IDS,
        DEFAULT_AI_ID,
        enabledModels,
        bootstrappedSiteIds,
        defaultAiModel,
        lastSelectedAI,
        setEnabledModels,
        setBootstrappedSiteIds,
        setDefaultAiModel,
        setLastSelectedAI
    ])

    // Ensure open tabs remain on valid models when registry removes a model.
    useEffect(() => {
        if (!isRegistryLoaded || GET_ALL_AI_IDS.length === 0 || tabs.length === 0) return

        const validIds = new Set(GET_ALL_AI_IDS)
        const fallbackModelId = validIds.has(defaultAiModel)
            ? defaultAiModel
            : (GET_ALL_AI_IDS[0] || DEFAULT_AI_ID)

        let tabsChanged = false
        const normalizedTabs = tabs.map((tab) => {
            if (validIds.has(tab.modelId)) return tab
            tabsChanged = true
            return { ...tab, modelId: fallbackModelId }
        })

        if (tabsChanged) {
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
        }
    }, [
        isRegistryLoaded,
        GET_ALL_AI_IDS,
        DEFAULT_AI_ID,
        tabs,
        activeTabId,
        defaultAiModel,
        setTabs,
        setPinnedTabs,
        setLastSelectedAI
    ])

    // Get active webview instance
    const webviewInstance = useMemo(() => webviewInstances[activeTabId] || null, [webviewInstances, activeTabId])

    // Temporary Ref wrapper to satisfy current useAiSender implementation
    const webviewRefProxy = useMemo(() => ({ current: webviewInstance }), [webviewInstance])

    const {
        sendTextToAI: rawSendText,
        sendImageToAI: rawSendImage
    } = useAiSender(webviewRefProxy, currentAI, autoSend, AI_REGISTRY)

    const sendTextToAI = useCallback(async (text: string) => {
        const result = await rawSendText(text)
        if (!result.success) {
            showWarning(`error_${result.error}`)
        }
        return result
    }, [rawSendText, showWarning])

    const sendImageToAI = useCallback(async (imageData: string) => {
        const result = await rawSendImage(imageData)
        if (result.success) {
            showSuccess('sent_successfully')
        } else {
            showWarning(`error_${result.error}`)
        }
        return result
    }, [rawSendImage, showSuccess, showWarning])

    const registerWebview = useCallback((id: string, instance: WebviewController | null) => {
        setWebviewInstances((prev) => {
            if (instance === null) {
                const { [id]: _, ...rest } = prev
                return rest
            }
            return { ...prev, [id]: instance }
        })
    }, [])

    const refreshRegistry = useCallback(async (force = false) => {
        if (force) {
            try {
                await refreshMutation.mutateAsync()
                showSuccess('toast_registry_refreshed')
            } catch {
                showWarning('toast_registry_load_error')
            }
        }
    }, [refreshMutation, showSuccess, showWarning])

    const value = useMemo(() => ({
        isRegistryLoaded,
        chromeUserAgent: registryData?.chromeUserAgent || '',

        tabs,
        activeTabId,
        addTab,
        closeTab,
        setActiveTab,
        renameTab,
        togglePinTab,

        currentAI,
        setCurrentAI,
        enabledModels,
        setEnabledModels,
        defaultAiModel,
        setDefaultAiModel,
        aiSites: AI_REGISTRY,
        autoSend,
        setAutoSend,
        toggleAutoSend,

        webviewInstance,
        registerWebview,

        sendTextToAI,
        sendImageToAI,
        refreshRegistry,
        isTutorialActive,
        startTutorial: () => setIsTutorialActive(true),
        stopTutorial: () => setIsTutorialActive(false)
    }), [
        isRegistryLoaded,
        registryData,
        tabs,
        activeTabId,
        addTab,
        closeTab,
        setActiveTab,
        renameTab,
        togglePinTab,
        currentAI,
        setCurrentAI,
        enabledModels,
        setEnabledModels,
        defaultAiModel,
        setDefaultAiModel,
        AI_REGISTRY,
        autoSend,
        setAutoSend,
        toggleAutoSend,
        sendTextToAI,
        sendImageToAI,
        webviewInstance,
        registerWebview,
        isTutorialActive,
        refreshRegistry
    ])

    return (
        <AiContext.Provider value={value}>
            {isRegistryLoaded && isTabsInitialized ? children : null}
        </AiContext.Provider>
    )
}

export const useAi = () => {
    const context = useContext(AiContext)
    if (!context) throw new Error('useAi must be used within AiProvider')
    return context
}

