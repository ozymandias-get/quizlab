import type {
    AiPlatform,
    AiRegistryResponse,
    AiSelectorConfig,
    CustomAiInput,
    CustomAiResult,
    GeminiWebSessionActionResult,
    GeminiWebSessionStatus,
    PdfSelection,
    PdfStreamResult,
    QuizActionResult,
    QuizAuthResult,
    QuizCliPathResult,
    QuizGenerateResult,
    QuizSettings,
    UpdateCheckResult
} from '@shared-core/types'
import { GOOGLE_WEB_SESSION_REGISTRY_IDS, type GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

const WEB_AI_REGISTRY: Record<string, AiPlatform> = {
    chatgpt: {
        id: 'chatgpt',
        name: 'ChatGPT',
        displayName: 'ChatGPT',
        url: 'https://chat.openai.com',
        isSite: true,
        color: '#10a37f',
        submitMode: 'enter_key'
    },
    gemini: {
        id: 'gemini',
        name: 'Gemini',
        displayName: 'Gemini',
        url: 'https://gemini.google.com',
        isSite: true,
        color: '#4285f4',
        submitMode: 'enter_key'
    },
    claude: {
        id: 'claude',
        name: 'Claude',
        displayName: 'Claude',
        url: 'https://claude.ai',
        isSite: true,
        color: '#d97706',
        submitMode: 'enter_key'
    },
    notebooklm: {
        id: 'notebooklm',
        name: 'NotebookLM',
        displayName: 'NotebookLM',
        url: 'https://notebooklm.google.com/',
        icon: 'notebooklm',
        color: '#34a853',
        submitMode: 'mixed'
    },
    aistudio: {
        id: 'aistudio',
        name: 'AI Studio',
        displayName: 'AI Studio',
        url: 'https://aistudio.google.com/welcome',
        icon: 'aistudio',
        color: '#4285f4',
        submitMode: 'mixed'
    },
    youtube: {
        id: 'youtube',
        name: 'YouTube',
        displayName: 'YouTube',
        url: 'https://www.youtube.com/',
        icon: 'youtube',
        isSite: true,
        color: '#ff0033',
        submitMode: 'mixed'
    }
}

const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
    questionCount: 10,
    difficulty: 'MEDIUM',
    model: 'gemini-2.5-flash',
    style: ['MIXED'],
    focusTopic: ''
}

const getPlatform = (): string => {
    const platform = navigator.platform.toLowerCase()
    if (platform.includes('mac')) return 'darwin'
    if (platform.includes('win')) return 'win32'
    if (platform.includes('linux')) return 'linux'
    return 'web'
}

const createGeminiStatus = (enabled: boolean, enabledAppIds: GoogleWebSessionAppId[]): GeminiWebSessionStatus => ({
    state: enabled ? 'auth_required' : 'uninitialized',
    lastHealthyAt: null,
    lastCheckAt: new Date().toISOString(),
    consecutiveFailures: 0,
    reasonCode: 'none',
    featureEnabled: enabled,
    enabled,
    enabledAppIds
})

const createUnsupportedAction = async (): Promise<QuizActionResult> => ({
    success: false,
    error: 'web_dev_mode_only'
})

const toMapRecord = <T>(map: Map<string, T>): Record<string, T> => {
    const record: Record<string, T> = {}
    for (const [key, value] of map.entries()) {
        record[key] = value
    }
    return record
}

const objectUrls = new Set<string>()
let beforeUnloadListenerRegistered = false

const trackObjectUrl = (objectUrl: string) => {
    objectUrls.add(objectUrl)
    return objectUrl
}

const revokeTrackedObjectUrls = () => {
    for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl)
    }
    objectUrls.clear()
}

const selectPdfInBrowser = (): Promise<PdfSelection | null> => {
    return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.pdf,application/pdf'
        const cleanup = () => {
            input.onchange = null
        }
        input.onchange = () => {
            const file = input.files?.[0]
            if (!file) {
                cleanup()
                resolve(null)
                return
            }

            const streamUrl = trackObjectUrl(URL.createObjectURL(file))
            cleanup()
            resolve({
                path: '',
                name: file.name,
                size: file.size,
                streamUrl
            })
        }
        input.click()
    })
}

export function createBrowserElectronApi(): Window['electronAPI'] {
    const aiConfigs = new Map<string, AiSelectorConfig>()
    const customPlatforms = new Map<string, AiPlatform>()
    let quizSettings: QuizSettings = { ...DEFAULT_QUIZ_SETTINGS }
    let geminiWebEnabled = false
    let geminiWebEnabledAppIds: GoogleWebSessionAppId[] = [...GOOGLE_WEB_SESSION_REGISTRY_IDS]

    if (typeof window !== 'undefined' && !beforeUnloadListenerRegistered) {
        window.addEventListener('beforeunload', revokeTrackedObjectUrls, { once: true })
        beforeUnloadListenerRegistered = true
    }

    const getAiRegistry = async (): Promise<AiRegistryResponse> => {
        const aiRegistry: Record<string, AiPlatform> = {
            ...WEB_AI_REGISTRY,
            ...toMapRecord(customPlatforms)
        }

        const enabledAppIds = new Set(geminiWebEnabledAppIds)
        for (const appId of GOOGLE_WEB_SESSION_REGISTRY_IDS) {
            if (!geminiWebEnabled || !enabledAppIds.has(appId)) {
                delete aiRegistry[appId]
            }
        }

        const allAiIds = Object.keys(aiRegistry)

        return {
            aiRegistry,
            defaultAiId: allAiIds.includes('chatgpt') ? 'chatgpt' : (allAiIds[0] || 'chatgpt'),
            allAiIds,
            chromeUserAgent: navigator.userAgent
        }
    }

    const getGeminiStatus = () => createGeminiStatus(geminiWebEnabled, geminiWebEnabledAppIds)

    return {
        getAiRegistry,
        isAuthDomain: async () => false,
        automation: {
            generateFocusScript: async () => null,
            generateClickSendScript: async () => null,
            generateAutoSendScript: async () => null,
            generatePickerScript: async () => null
        },

        selectPdf: async () => selectPdfInBrowser(),
        getPdfStreamUrl: async (): Promise<PdfStreamResult | null> => null,
        registerPdfPath: async () => null,

        captureScreen: async () => null,
        copyImageToClipboard: async (dataUrl: string) => {
            try {
                if (!navigator.clipboard?.writeText) return false
                await navigator.clipboard.writeText(dataUrl)
                return true
            } catch {
                return false
            }
        },
        copyTextToClipboard: async (text: string) => {
            try {
                if (!navigator.clipboard?.writeText) return false
                await navigator.clipboard.writeText(text)
                return true
            } catch {
                return false
            }
        },
        openExternal: async (url: string) => {
            try {
                const parsedUrl = new URL(url)
                const allowedProtocols = new Set(['http:', 'https:', 'mailto:'])
                if (!allowedProtocols.has(parsedUrl.protocol)) {
                    return false
                }
                window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer')
                return true
            } catch {
                return false
            }
        },
        forcePaste: async () => false,
        showPdfContextMenu: () => { },
        onTriggerScreenshot: () => () => { },

        platform: getPlatform(),
        quitApp: async () => { },

        checkForUpdates: async (): Promise<UpdateCheckResult> => ({ available: false, cached: true }),
        openReleasesPage: async () => { },
        getAppVersion: async () => 'dev-web',
        clearCache: async () => true,

        saveAiConfig: async (hostname, config) => {
            aiConfigs.set(hostname, config)
            return true
        },
        getAiConfig: async (hostname) => {
            if (hostname) return aiConfigs.get(hostname) || null
            return toMapRecord(aiConfigs)
        },
        deleteAiConfig: async (hostname) => aiConfigs.delete(hostname),
        addCustomAi: async (data: CustomAiInput): Promise<CustomAiResult> => {
            const name = data?.name?.trim()
            const url = data?.url?.trim()
            if (!name || !url) {
                return { success: false, error: 'invalid_input' }
            }

            const id = `custom-${Date.now()}`
            const platform: AiPlatform = {
                id,
                name,
                displayName: name,
                url,
                isSite: data.isSite ?? true,
                isCustom: true,
                submitMode: 'enter_key'
            }
            customPlatforms.set(id, platform)
            return { success: true, id, platform }
        },
        deleteCustomAi: async (id) => customPlatforms.delete(id),

        quiz: {
            generate: async (): Promise<QuizGenerateResult> => ({
                success: false,
                error: 'web_dev_mode_only'
            }),
            getSettings: async () => quizSettings,
            saveSettings: async (settings) => {
                quizSettings = { ...quizSettings, ...settings }
                return true
            },
            getCliPath: async (): Promise<QuizCliPathResult> => ({ path: '', exists: false }),
            openLogin: createUnsupportedAction,
            checkAuth: async (): Promise<QuizAuthResult> => ({ authenticated: false }),
            logout: async () => ({ success: true }),
            askAssistant: async (question: string) => {
                const trimmed = question.trim()
                if (!trimmed) return { success: false, error: 'empty_question' }
                return {
                    success: true,
                    data: {
                        answer: 'Web dev mode mock response.',
                        suggestions: ['Run in Electron for full features', 'Test another prompt']
                    }
                }
            }
        },

        geminiWeb: {
            getStatus: async () => getGeminiStatus(),
            openLogin: async (): Promise<GeminiWebSessionActionResult> => ({
                success: false,
                error: 'web_dev_mode_only'
            }),
            checkNow: async () => ({ success: true, status: getGeminiStatus() }),
            reauth: async () => ({ success: false, error: 'web_dev_mode_only', status: getGeminiStatus() }),
            resetProfile: async () => ({ success: true, status: getGeminiStatus() }),
            setEnabled: async (enabled: boolean) => {
                geminiWebEnabled = enabled
                return { success: true, status: getGeminiStatus() }
            },
            setEnabledApps: async (enabledAppIds: GoogleWebSessionAppId[]) => {
                const validIds = new Set(GOOGLE_WEB_SESSION_REGISTRY_IDS)
                const nextIds: GoogleWebSessionAppId[] = []

                for (const appId of enabledAppIds) {
                    if (!validIds.has(appId)) continue
                    if (nextIds.includes(appId)) continue
                    nextIds.push(appId)
                }

                geminiWebEnabledAppIds = nextIds
                return { success: true, status: getGeminiStatus() }
            }
        }
    }
}

