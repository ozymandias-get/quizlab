import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import type {
  AiSelectorConfig,
  AiRegistryResponse,
  AutomationConfig,
  PdfSelectOptions,
  PdfSelection,
  PdfStreamResult,
  PdfViewerZoomAction,
  UpdateCheckResult,
  CustomAiInput,
  CustomAiResult,
  GeminiWebSessionStatus,
  GeminiWebSessionActionResult,
  GeminiWebSessionRefreshEvent,
  ScreenshotType
} from '@shared-core/types'
import type { ElectronApi, WaitForSubmitReadyOptions } from '@shared-core/types/ipcContract'
import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

const electronApi: ElectronApi = {
  getAiRegistry: (forceRefresh: boolean = false): Promise<AiRegistryResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_AI_REGISTRY, forceRefresh),
  isAuthDomain: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.IS_AUTH_DOMAIN, url),
  automation: {
    generateFocusScript: (config: AutomationConfig): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generateFocusScript', config),
    generateClickSendScript: (config: AutomationConfig): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generateClickSendScript', config),
    generateAutoSendScript: (
      config: AutomationConfig,
      text: string,
      submit: boolean,
      append?: boolean
    ): Promise<string | null> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
        'generateAutoSendScript',
        config,
        text,
        submit,
        append === true
      ),
    generateValidateSelectorsScript: (config: AutomationConfig): Promise<string | null> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
        'generateValidateSelectorsScript',
        config
      ),
    generateWaitForSubmitReadyScript: (
      config: AutomationConfig,
      options?: WaitForSubmitReadyOptions
    ): Promise<string | null> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
        'generateWaitForSubmitReadyScript',
        config,
        options
      ),
    generatePickerScript: (translations: Record<string, string>): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generatePickerScript', translations)
  },

  selectPdf: (options?: PdfSelectOptions): Promise<PdfSelection | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_PDF, options),
  getPdfStreamUrl: (filePath: string): Promise<PdfStreamResult | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PDF_STREAM_URL, filePath),
  registerPdfPath: (filePath: string): Promise<PdfSelection | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.PDF_REGISTER_PATH, filePath),

  captureScreen: (rect?: {
    x: number
    y: number
    width: number
    height: number
  }): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_SCREEN, rect),
  copyImageToClipboard: (dataUrl: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.COPY_IMAGE, dataUrl),
  copyTextToClipboard: (text: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.COPY_TEXT, text),
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),
  forcePaste: (webContentsId: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.FORCE_PASTE, webContentsId),
  showPdfContextMenu: (labels: Partial<Record<string, string>>): void =>
    ipcRenderer.send(IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU, labels),

  onTriggerScreenshot: (callback: (type: ScreenshotType) => void) => {
    const handler = (_event: IpcRendererEvent, type: ScreenshotType) => callback(type)
    ipcRenderer.on(IPC_CHANNELS.TRIGGER_SCREENSHOT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRIGGER_SCREENSHOT, handler)
  },
  onPdfViewerZoom: (callback: (action: PdfViewerZoomAction) => void) => {
    const handler = (_event: IpcRendererEvent, action: PdfViewerZoomAction) => callback(action)
    ipcRenderer.on(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, handler)
  },

  platform: process.platform,
  quitApp: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT),

  checkForUpdates: (): Promise<UpdateCheckResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
  openReleasesPage: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.OPEN_RELEASES),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
  clearCache: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_CACHE),

  saveAiConfig: (hostname: string, config: AiSelectorConfig): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_AI_CONFIG, hostname, config),
  getAiConfig: (
    hostname?: string
  ): Promise<AiSelectorConfig | Record<string, AiSelectorConfig> | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_AI_CONFIG, hostname),
  deleteAiConfig: (hostname: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_AI_CONFIG, hostname),
  addCustomAi: (data: CustomAiInput): Promise<CustomAiResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_CUSTOM_AI, data),
  deleteCustomAi: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CUSTOM_AI, id),

  geminiWeb: {
    getStatus: (): Promise<GeminiWebSessionStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.GEMINI_WEB_STATUS),
    openLogin: (): Promise<GeminiWebSessionActionResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GEMINI_WEB_OPEN_LOGIN),
    checkNow: (): Promise<GeminiWebSessionActionResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GEMINI_WEB_CHECK_NOW),
    reauth: (): Promise<GeminiWebSessionActionResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GEMINI_WEB_REAUTH),
    resetProfile: (): Promise<GeminiWebSessionActionResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE),
    setEnabled: (enabled: boolean): Promise<GeminiWebSessionActionResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED, enabled),
    setEnabledApps: (
      enabledAppIds: GoogleWebSessionAppId[]
    ): Promise<GeminiWebSessionActionResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS, enabledAppIds),
    onRefreshEvent: (callback: (event: GeminiWebSessionRefreshEvent) => void) => {
      const handlers: Array<
        [string, (event: IpcRendererEvent, payload: GeminiWebSessionRefreshEvent) => void]
      > = [
        [
          IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_STARTED,
          (_event: IpcRendererEvent, payload: GeminiWebSessionRefreshEvent) => callback(payload)
        ],
        [
          IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_SUCCESS,
          (_event: IpcRendererEvent, payload: GeminiWebSessionRefreshEvent) => callback(payload)
        ],
        [
          IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_FAILED,
          (_event: IpcRendererEvent, payload: GeminiWebSessionRefreshEvent) => callback(payload)
        ]
      ]

      for (const [channel, handler] of handlers) {
        ipcRenderer.on(channel, handler)
      }

      return () => {
        for (const [channel, handler] of handlers) {
          ipcRenderer.removeListener(channel, handler)
        }
      }
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronApi)
