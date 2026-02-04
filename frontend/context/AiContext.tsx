import React, { createContext, useContext, useMemo, useCallback, useState, useEffect } from 'react'
import { STORAGE_KEYS } from '../constants/storageKeys'
import { useLocalStorage, useLocalStorageString, useLocalStorageBoolean, useAiSender } from '../hooks'
import { useToast } from './ToastContext'
import type { AiRegistryResponse, AiPlatform } from '../types/global'
import type { WebviewController } from '../types/webview'
import type { SendImageResult, SendTextResult } from '../hooks/useAiSender'

type AiRegistryData = AiRegistryResponse

interface AiContextType {
    isRegistryLoaded: boolean;
    chromeUserAgent: string;
    currentAI: string;
    setCurrentAI: (id: string) => void;
    enabledModels: string[];
    setEnabledModels: (models: string[]) => void;
    aiSites: Record<string, AiPlatform>;
    autoSend: boolean;
    setAutoSend: (value: boolean) => void;
    toggleAutoSend: () => void;
    webviewInstance: WebviewController | null;
    registerWebview: (instance: WebviewController | null) => void;
    sendTextToAI: (text: string) => Promise<SendTextResult>;
    sendImageToAI: (imageData: string) => Promise<SendImageResult>;
    refreshRegistry: (force?: boolean) => Promise<void>;
    isTutorialActive: boolean;
    startTutorial: () => void;
    stopTutorial: () => void;
}

const AiContext = createContext<AiContextType | null>(null)

const DEFAULT_REGISTRY: AiRegistryData = {
    aiRegistry: {} as Record<string, AiPlatform>,
    defaultAiId: 'chatgpt',
    allAiIds: [],
    chromeUserAgent: ''
}

export function AiProvider({ children }: { children: React.ReactNode }) {
    const [registryData, setRegistryData] = useState<AiRegistryData | null>(null)
    const [isRegistryLoaded, setIsRegistryLoaded] = useState(false)
    const { showSuccess, showWarning } = useToast()

    // Webview Instance State (Reactive)
    const [webviewInstance, setWebviewInstance] = useState<WebviewController | null>(null)
    const [isTutorialActive, setIsTutorialActive] = useState(false)

    const loadRegistry = useCallback(async (force = false) => {
        try {
            const API = window.electronAPI
            if (API?.getAiRegistry) {
                setRegistryData(await API.getAiRegistry(force))
            } else {
                setRegistryData(DEFAULT_REGISTRY)
            }
        } catch (error) {
            console.error('[AiContext] Failed to load AI registry:', error)
            showWarning('toast_registry_load_error')
            setRegistryData(DEFAULT_REGISTRY)
        } finally {
            setIsRegistryLoaded(true)
        }
    }, [showWarning])

    useEffect(() => {
        loadRegistry()
    }, [loadRegistry])

    const AI_REGISTRY = (registryData?.aiRegistry || {}) as Record<string, AiPlatform>
    const DEFAULT_AI_ID = registryData?.defaultAiId || 'chatgpt'
    const GET_ALL_AI_IDS = registryData?.allAiIds || []

    const [currentAI, setCurrentAI] = useLocalStorageString(STORAGE_KEYS.LAST_SELECTED_AI, DEFAULT_AI_ID, GET_ALL_AI_IDS)
    const [enabledModels, setEnabledModels] = useLocalStorage<string[]>(STORAGE_KEYS.ENABLED_MODELS, GET_ALL_AI_IDS)
    const [autoSend, setAutoSend, toggleAutoSend] = useLocalStorageBoolean(STORAGE_KEYS.AUTO_SEND_ENABLED, false)

    // Sync enabledModels with registry on first load (when localStorage is empty)
    useEffect(() => {
        if (isRegistryLoaded && GET_ALL_AI_IDS.length > 0 && enabledModels.length === 0) {
            setEnabledModels(GET_ALL_AI_IDS)
        }
    }, [isRegistryLoaded, GET_ALL_AI_IDS, enabledModels.length, setEnabledModels])

    // Temporary Ref wrapper to satisfy current useAiSender implementation
    // We will update useAiSender next to accept instance directly
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

    const registerWebview = useCallback((instance: WebviewController | null) => {
        setWebviewInstance(instance)
    }, [])

    const value = useMemo(() => ({
        isRegistryLoaded,
        chromeUserAgent: registryData?.chromeUserAgent || '',
        currentAI, setCurrentAI,
        enabledModels, setEnabledModels,
        aiSites: AI_REGISTRY,
        autoSend, setAutoSend, toggleAutoSend,
        webviewInstance, registerWebview,
        sendTextToAI, sendImageToAI,
        refreshRegistry: loadRegistry,
        isTutorialActive,
        startTutorial: () => setIsTutorialActive(true),
        stopTutorial: () => setIsTutorialActive(false)
    }), [
        isRegistryLoaded, registryData, currentAI, setCurrentAI, enabledModels, setEnabledModels,
        AI_REGISTRY, autoSend, setAutoSend, toggleAutoSend, sendTextToAI, sendImageToAI,
        webviewInstance, registerWebview, isTutorialActive, loadRegistry
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
