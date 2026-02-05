import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { AiPlatform, AiSelectorConfig } from '../modules/ai/aiManager'
import type { AutomationConfig } from '../modules/automation/automationScripts'

type AiRegistryResponse = {
    aiRegistry: Record<string, AiPlatform>;
    defaultAiId: string;
    allAiIds: string[];
    chromeUserAgent: string;
}

type PdfSelectOptions = { filterName?: string }
type PdfSelection = { path: string; name: string; size: number; streamUrl: string }
type PdfStreamResult = { streamUrl: string }
type UpdateCheckResult = { available: boolean; version?: string; releaseNotes?: string; cached?: boolean; error?: string }
type CustomAiInput = { name: string; url: string }
type CustomAiResult = { success: boolean; id?: string; platform?: AiPlatform; error?: string }
type QuizSettings = { questionCount: number; difficulty: string; model: string; style: string[]; focusTopic: string; cliPath?: string }
type QuizGenerateResult = { success: boolean; data?: unknown[]; count?: number; error?: string }
type QuizCliPathResult = { path: string; exists: boolean }
type QuizAuthResult = { authenticated: boolean; account?: string | null }
type QuizActionResult = { success: boolean; error?: string }

let _aiRegistryCache: AiRegistryResponse | null = null

contextBridge.exposeInMainWorld('electronAPI', {
    // AI & Automation
    getAiRegistry: async (forceRefresh: boolean = false): Promise<AiRegistryResponse> => {
        if (!_aiRegistryCache || forceRefresh) {
            _aiRegistryCache = await ipcRenderer.invoke('get-ai-registry')
        }
        if (!_aiRegistryCache) {
            throw new Error('AI registry not available')
        }
        return _aiRegistryCache
    },
    isAuthDomain: (url: string): Promise<boolean> => ipcRenderer.invoke('is-auth-domain', url),
    automation: {
        generateFocusScript: (config: AutomationConfig): Promise<string | null> => ipcRenderer.invoke('get-automation-scripts', 'generateFocusScript', config),
        generateClickSendScript: (config: AutomationConfig): Promise<string | null> => ipcRenderer.invoke('get-automation-scripts', 'generateClickSendScript', config),
        generateAutoSendScript: (config: AutomationConfig, text: string, submit: boolean): Promise<string | null> => ipcRenderer.invoke('get-automation-scripts', 'generateAutoSendScript', config, text, submit),
        generatePickerScript: (translations: Record<string, string>): Promise<string | null> => ipcRenderer.invoke('get-automation-scripts', 'generatePickerScript', translations)
    },

    // PDF
    selectPdf: (options: PdfSelectOptions): Promise<PdfSelection | null> => ipcRenderer.invoke('select-pdf', options),
    getPdfStreamUrl: (filePath: string): Promise<PdfStreamResult | null> => ipcRenderer.invoke('get-pdf-stream-url', filePath),
    registerPdfPath: (filePath: string): Promise<PdfSelection | null> => ipcRenderer.invoke('pdf:register-path', filePath),

    // Utilities
    captureScreen: (rect?: { x: number; y: number; width: number; height: number }): Promise<string | null> => ipcRenderer.invoke('capture-screen', rect),
    copyImageToClipboard: (dataUrl: string): Promise<boolean> => ipcRenderer.invoke('copy-image-to-clipboard', dataUrl),
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('open-external', url),
    forcePaste: (webContentsId: number): Promise<boolean> => ipcRenderer.invoke('force-paste-in-webview', webContentsId),
    showPdfContextMenu: (labels: Partial<Record<string, string>>): void => ipcRenderer.send('show-pdf-context-menu', labels),

    // Events
    onTriggerScreenshot: (callback: (type: string) => void) => {
        const handler = (event: IpcRendererEvent, type: string) => callback(type)
        ipcRenderer.on('trigger-screenshot', handler)
        return () => ipcRenderer.removeListener('trigger-screenshot', handler)
    },

    // Meta
    platform: process.platform,

    // Updater
    checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('check-for-updates'),
    openReleasesPage: (): Promise<void> => ipcRenderer.invoke('open-releases-page'),
    getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
    clearCache: (): Promise<boolean> => ipcRenderer.invoke('clear-cache'),

    // AI Config
    saveAiConfig: (hostname: string, config: AiSelectorConfig): Promise<boolean> => ipcRenderer.invoke('save-ai-config', hostname, config),
    getAiConfig: (hostname?: string): Promise<AiSelectorConfig | Record<string, AiSelectorConfig> | null> => ipcRenderer.invoke('get-ai-config', hostname),
    deleteAiConfig: (hostname: string): Promise<boolean> => ipcRenderer.invoke('delete-ai-config', hostname),
    deleteAllAiConfigs: (): Promise<boolean> => ipcRenderer.invoke('delete-all-ai-configs'),
    addCustomAi: (data: CustomAiInput): Promise<CustomAiResult> => ipcRenderer.invoke('add-custom-ai', data),
    deleteCustomAi: (id: string): Promise<boolean> => ipcRenderer.invoke('delete-custom-ai', id),

    // Library Management (New v1.0)
    library: {
        getFileSystem: () => ipcRenderer.invoke('db:get-file-system'),
        createFolder: (name: string, parentId: string | null) => ipcRenderer.invoke('db:create-folder', name, parentId),
        deleteItem: (id: string) => ipcRenderer.invoke('db:delete-item', id),
        importFile: (sourcePath: string, folderId: string | null = null) => ipcRenderer.invoke('file:import', sourcePath, folderId),
        moveItem: (id: string, newParentId: string | null) => ipcRenderer.invoke('db:move-item', id, newParentId),
        search: (query: string) => ipcRenderer.invoke('db:search-library', query),

        // Notes
        getNotes: (fileId: string) => ipcRenderer.invoke('db:get-notes', fileId),
        saveNote: (params: any) => ipcRenderer.invoke('db:save-note', params),
        deleteNote: (id: string) => ipcRenderer.invoke('db:delete-note', id)
    },

    // Quiz Generation API
    quiz: {
        generate: (params: Record<string, unknown>): Promise<QuizGenerateResult> => ipcRenderer.invoke('generate-quiz-cli', params),
        getSettings: (): Promise<QuizSettings> => ipcRenderer.invoke('get-quiz-settings'),
        saveSettings: (settings: Partial<QuizSettings>): Promise<boolean> => ipcRenderer.invoke('save-quiz-settings', settings),
        getCliPath: (): Promise<QuizCliPathResult> => ipcRenderer.invoke('get-gemini-cli-path'),
        openLogin: (): Promise<QuizActionResult> => ipcRenderer.invoke('open-gemini-login'),
        checkAuth: (): Promise<QuizAuthResult> => ipcRenderer.invoke('check-gemini-auth'),
        logout: (): Promise<QuizActionResult> => ipcRenderer.invoke('gemini-logout'),
        askAssistant: (question: string, context?: string): Promise<{ success: boolean; data?: any; error?: string }> => ipcRenderer.invoke('ask-ai-assistant', { question, context })
    }
})
