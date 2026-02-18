import React, { createContext, useContext, useMemo, useCallback, useState, useEffect } from 'react'
import { STORAGE_KEYS } from '@src/constants/storageKeys'
import { useLocalStorage, useLocalStorageString, useLocalStorageBoolean } from '@src/hooks'
import { useToast } from './ToastContext'
import type { AiPlatform } from '@shared/types'
import type { WebviewController } from '@shared/types/webview';
import { useAiSender } from '@features/ai/hooks/useAiSender'
import type { SendImageResult, SendTextResult } from '@features/ai/hooks/useAiSender'
import { useAiRegistry, useRefreshAiRegistry } from '@platform/electron/api/useAiApi'



export interface Tab {
    id: string;
    modelId: string;
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

    // Legacy support (mapped to active tab)
    currentAI: string;
    setCurrentAI: (id: string) => void;

    enabledModels: string[];
    setEnabledModels: (models: string[]) => void;
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
    const refreshMutation = useRefreshAiRegistry()

    const isRegistryLoaded = !isLoading && !isError && !!registryData

    // Webview Instances State (Map by Tab ID)
    const [webviewInstances, setWebviewInstances] = useState<Record<string, WebviewController>>({})
    const [isTutorialActive, setIsTutorialActive] = useState(false)

    // Refresh Registry


    const AI_REGISTRY = (registryData?.aiRegistry || {}) as Record<string, AiPlatform>
    const DEFAULT_AI_ID = registryData?.defaultAiId || 'chatgpt'
    const GET_ALL_AI_IDS = registryData?.allAiIds || []

    const [lastSelectedAI, setLastSelectedAI] = useLocalStorageString(STORAGE_KEYS.LAST_SELECTED_AI, DEFAULT_AI_ID, GET_ALL_AI_IDS)
    const [enabledModels, setEnabledModels] = useLocalStorage<string[]>(STORAGE_KEYS.ENABLED_MODELS, GET_ALL_AI_IDS)
    const [autoSend, setAutoSend, toggleAutoSend] = useLocalStorageBoolean(STORAGE_KEYS.AUTO_SEND_ENABLED, false)

    // --- Tab Management ---
    // Initialize with one tab based on lastSelectedAI
    const [tabs, setTabs] = useState<Tab[]>(() => [{ id: 'default-tab', modelId: lastSelectedAI }])
    const [activeTabId, setActiveTabId] = useState<string>('default-tab')

    // Initial sync for tabs if empty (should not happen due to initial state, but for safety)
    useEffect(() => {
        if (tabs.length === 0) {
            const newTabId = crypto.randomUUID();
            setTabs([{ id: newTabId, modelId: lastSelectedAI }]);
            setActiveTabId(newTabId);
        }
    }, [tabs.length, lastSelectedAI]);

    const addTab = useCallback((modelId: string) => {
        const newTabId = crypto.randomUUID();
        setTabs(prev => [...prev, { id: newTabId, modelId }]);
        setActiveTabId(newTabId); // Switch to new tab automatically
    }, []);

    const closeTab = useCallback((tabId: string) => {
        setTabs(prev => {
            if (prev.length <= 1) return prev; // Don't close the last tab
            const newTabs = prev.filter(t => t.id !== tabId);

            // If we closed the active tab, switch to the last one
            if (tabId === activeTabId) {
                setActiveTabId(newTabs[newTabs.length - 1].id);
            }
            return newTabs;
        });

        // Clean up webview instance
        setWebviewInstances(prev => {
            const newInstances = { ...prev };
            delete newInstances[tabId];
            return newInstances;
        });
    }, [activeTabId]);

    // Computed currentAI based on active tab
    const currentAI = useMemo(() => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        return activeTab?.modelId || lastSelectedAI;
    }, [tabs, activeTabId, lastSelectedAI]);

    const setCurrentAI = useCallback((id: string) => {
        // Update the model of the active tab
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, modelId: id } : t
        ));
        setLastSelectedAI(id); // Update persistence
    }, [activeTabId, setLastSelectedAI]);

    // Sync enabledModels with registry on first load
    useEffect(() => {
        if (isRegistryLoaded && GET_ALL_AI_IDS.length > 0 && enabledModels.length === 0) {
            setEnabledModels(GET_ALL_AI_IDS)
        }
    }, [isRegistryLoaded, GET_ALL_AI_IDS, enabledModels.length, setEnabledModels])

    // Get active webview instance
    const webviewInstance = useMemo(() => webviewInstances[activeTabId] || null, [webviewInstances, activeTabId]);

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
        setWebviewInstances(prev => {
            if (instance === null) {
                const { [id]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [id]: instance };
        });
    }, [])

    const refreshRegistry = useCallback(async (force = false) => {
        if (force) {
            try {
                await refreshMutation.mutateAsync()
                showSuccess('toast_registry_refreshed')
            } catch (error) {
                showWarning('toast_registry_load_error')
            }
        }
    }, [refreshMutation, showSuccess, showWarning])

    const value = useMemo(() => ({
        isRegistryLoaded,
        chromeUserAgent: registryData?.chromeUserAgent || '',

        tabs, activeTabId, addTab, closeTab, setActiveTab: setActiveTabId,

        currentAI, setCurrentAI,
        enabledModels, setEnabledModels,
        aiSites: AI_REGISTRY,
        autoSend, setAutoSend, toggleAutoSend,

        webviewInstance, registerWebview,

        sendTextToAI, sendImageToAI,
        refreshRegistry,
        isTutorialActive,
        startTutorial: () => setIsTutorialActive(true),
        stopTutorial: () => setIsTutorialActive(false)
    }), [
        isRegistryLoaded, registryData,
        tabs, activeTabId, addTab, closeTab,
        currentAI, setCurrentAI,
        enabledModels, setEnabledModels,
        AI_REGISTRY, autoSend, setAutoSend, toggleAutoSend,
        sendTextToAI, sendImageToAI,
        webviewInstance, registerWebview,
        isTutorialActive, refreshRegistry
    ])

    return (
        <AiContext.Provider value={value}>
            {isRegistryLoaded ? children : null}
        </AiContext.Provider>
    )
}

export const useAi = () => {
    const context = useContext(AiContext)
    if (!context) throw new Error('useAi must be used within AiProvider')
    return context
}


