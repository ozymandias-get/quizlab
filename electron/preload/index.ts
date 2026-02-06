import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import type {
    AiPlatform,
    AiSelectorConfig,
    AiRegistryResponse,
    AutomationConfig,
    PdfSelectOptions,
    PdfSelection,
    PdfStreamResult,
    UpdateCheckResult,
    CustomAiInput,
    CustomAiResult,
    QuizSettings,
    QuizGenerateResult,
    QuizCliPathResult,
    QuizAuthResult,
    QuizActionResult
} from '@shared/types'

let _aiRegistryCache: AiRegistryResponse | null = null

contextBridge.exposeInMainWorld('electronAPI', {
    // AI & Automation
    getAiRegistry: async (forceRefresh: boolean = false): Promise<AiRegistryResponse> => {
        if (!_aiRegistryCache || forceRefresh) {
            _aiRegistryCache = await ipcRenderer.invoke(IPC_CHANNELS.GET_AI_REGISTRY)
        }
        if (!_aiRegistryCache) {
            throw new Error('AI registry not available')
        }
        return _aiRegistryCache
    },
    isAuthDomain: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.IS_AUTH_DOMAIN, url),
    automation: {
        generateFocusScript: (config: AutomationConfig): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generateFocusScript', config),
        generateClickSendScript: (config: AutomationConfig): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generateClickSendScript', config),
        generateAutoSendScript: (config: AutomationConfig, text: string, submit: boolean): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generateAutoSendScript', config, text, submit),
        generatePickerScript: (translations: Record<string, string>): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generatePickerScript', translations)
    },

    // PDF
    selectPdf: (options: PdfSelectOptions): Promise<PdfSelection | null> => ipcRenderer.invoke(IPC_CHANNELS.SELECT_PDF, options),
    getPdfStreamUrl: (filePath: string): Promise<PdfStreamResult | null> => ipcRenderer.invoke(IPC_CHANNELS.GET_PDF_STREAM_URL, filePath),
    registerPdfPath: (filePath: string): Promise<PdfSelection | null> => ipcRenderer.invoke(IPC_CHANNELS.PDF_REGISTER_PATH, filePath),

    // Utilities
    captureScreen: (rect?: { x: number; y: number; width: number; height: number }): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_SCREEN, rect),
    copyImageToClipboard: (dataUrl: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.COPY_IMAGE, dataUrl),
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),
    forcePaste: (webContentsId: number): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.FORCE_PASTE, webContentsId),
    showPdfContextMenu: (labels: Partial<Record<string, string>>): void => ipcRenderer.send(IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU, labels),

    // Events
    onTriggerScreenshot: (callback: (type: string) => void) => {
        const handler = (_event: IpcRendererEvent, type: string) => callback(type)
        ipcRenderer.on(IPC_CHANNELS.TRIGGER_SCREENSHOT, handler)
        return () => ipcRenderer.removeListener(IPC_CHANNELS.TRIGGER_SCREENSHOT, handler)
    },

    // Meta
    platform: process.platform,

    // Updater
    checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
    openReleasesPage: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.OPEN_RELEASES),
    getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
    clearCache: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_CACHE),

    // AI Config
    saveAiConfig: (hostname: string, config: AiSelectorConfig): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.SAVE_AI_CONFIG, hostname, config),
    getAiConfig: (hostname?: string): Promise<AiSelectorConfig | Record<string, AiSelectorConfig> | null> => ipcRenderer.invoke(IPC_CHANNELS.GET_AI_CONFIG, hostname),
    deleteAiConfig: (hostname: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.DELETE_AI_CONFIG, hostname),
    deleteAllAiConfigs: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ALL_AI_CONFIGS),
    addCustomAi: (data: CustomAiInput): Promise<CustomAiResult> => ipcRenderer.invoke(IPC_CHANNELS.ADD_CUSTOM_AI, data),
    deleteCustomAi: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CUSTOM_AI, id),

    // Library Management (New v1.0)
    library: {
        getFileSystem: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_FILE_SYSTEM),
        createFolder: (name: string, parentId: string | null) => ipcRenderer.invoke(IPC_CHANNELS.DB_CREATE_FOLDER, name, parentId),
        deleteItem: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_ITEM, id),
        importFile: (sourcePath: string, folderId: string | null = null) => ipcRenderer.invoke(IPC_CHANNELS.FILE_IMPORT, sourcePath, folderId),
        moveItem: (id: string, newParentId: string | null) => ipcRenderer.invoke(IPC_CHANNELS.DB_MOVE_ITEM, id, newParentId),
        search: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_SEARCH_LIBRARY, query),

        // Notes
        getNotes: (fileId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_NOTES, fileId),
        saveNote: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_NOTE, params),
        deleteNote: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_NOTE, id)
    },

    // Quiz Generation API
    quiz: {
        generate: (params: Record<string, unknown>): Promise<QuizGenerateResult> => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_QUIZ_CLI, params),
        getSettings: (): Promise<QuizSettings> => ipcRenderer.invoke(IPC_CHANNELS.GET_QUIZ_SETTINGS),
        saveSettings: (settings: Partial<QuizSettings>): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.SAVE_QUIZ_SETTINGS, settings),
        getCliPath: (): Promise<QuizCliPathResult> => ipcRenderer.invoke(IPC_CHANNELS.GET_GEMINI_CLI_PATH),
        openLogin: (): Promise<QuizActionResult> => ipcRenderer.invoke(IPC_CHANNELS.OPEN_GEMINI_LOGIN),
        checkAuth: (): Promise<QuizAuthResult> => ipcRenderer.invoke(IPC_CHANNELS.CHECK_GEMINI_AUTH),
        logout: (): Promise<QuizActionResult> => ipcRenderer.invoke(IPC_CHANNELS.GEMINI_LOGOUT),
        askAssistant: (question: string, context?: string): Promise<{ success: boolean; data?: unknown; error?: string }> => ipcRenderer.invoke(IPC_CHANNELS.ASK_AI, { question, context })
    }
})
