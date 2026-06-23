import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'
import type {
  AiRegistryResponse,
  AiSelectorConfig,
  ApiChatMessage,
  ApiConfig,
  AutomationConfig,
  ClearAiModelDataInput,
  CustomAiInput,
  CustomAiResult,
  GeminiWebSessionActionResult,
  GeminiWebSessionRefreshEvent,
  GeminiWebSessionStatus,
  PdfSelection,
  PdfSelectOptions,
  PdfStreamResult,
  PdfViewerZoomAction,
  ScreenshotType,
  TextInputMode,
  UpdateCheckResult
} from '@shared-core/types'
import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { type IPC_CHANNELS } from '../constants/ipc-channels'
import type { IpcResult } from '../lib/typedIpc'

/**
 * IPC contract between renderer (preload window.electronAPI) and the main process.
 *
 * This file is the single source of truth for:
 * - which channels are invoked via ipcRenderer.invoke / ipcMain.handle
 * - what argument tuples they expect
 * - what result type they resolve with
 *
 * Conventions:
 * - Use tuple types in `args` to reflect the exact invoke signature.
 * - Prefer `null` results for "not found" / "user cancelled" flows (PDF selection, etc.).
 * - Event-style channels (ipcRenderer.on/ipcMain.on) are excluded on purpose.
 *
 * NOTE:
 * - Event-style channels that use ipcRenderer.on/ipcMain.on are intentionally excluded.
 * - The structure is designed to be easy to reference in both tests and typings.
 */

export interface IpcInvokeRequestMap {
  // PDF selection / streaming
  [IPC_CHANNELS.SELECT_PDF]: {
    args: [options?: PdfSelectOptions]
    result: IpcResult<PdfSelection | null>
  }

  [IPC_CHANNELS.SELECT_FOLDER]: {
    args: [options?: { title?: string; defaultPath?: string }]
    result: IpcResult<{ path: string } | null>
  }

  [IPC_CHANNELS.GET_PDF_STREAM_URL]: {
    args: [filePath: string]
    result: IpcResult<PdfStreamResult>
  }

  [IPC_CHANNELS.PDF_REGISTER_PATH]: {
    args: [filePath: string]
    result: IpcResult<PdfSelection>
  }

  // Screenshot & clipboard
  [IPC_CHANNELS.CAPTURE_SCREEN]: {
    args: [rect?: { x: number; y: number; width: number; height: number }]
    result: IpcResult<string> // data URL
  }

  [IPC_CHANNELS.COPY_IMAGE]: {
    args: [dataUrl: string]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.COPY_TEXT]: {
    args: [text: string]
    result: IpcResult<boolean>
  }

  // Shell / system helpers
  [IPC_CHANNELS.OPEN_EXTERNAL]: {
    args: [url: string]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.APP_QUIT]: {
    args: []
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.GET_API_CHAT_CONFIG]: {
    args: []
    result: IpcResult<ApiConfig>
  }

  [IPC_CHANNELS.SAVE_API_CHAT_CONFIG]: {
    args: [config: ApiConfig]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.CANCEL_API_CHAT_REQUEST]: {
    args: []
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.SEND_API_CHAT_REQUEST]: {
    args: [
      messages: ApiChatMessage[],
      selectedModel?: string,
      generalPrompt?: string,
      providerId?: string
    ]
    result: IpcResult<ApiChatMessage>
  }

  [IPC_CHANNELS.FETCH_API_CHAT_MODELS]: {
    args: [providerId: string]
    result: IpcResult<string[]>
  }

  [IPC_CHANNELS.CLEAR_CACHE]: {
    args: []
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.CLEAR_AI_MODEL_DATA]: {
    args: [input: ClearAiModelDataInput]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.CACHE_INFO]: {
    args: []
    result: IpcResult<CacheInfoResponse>
  }

  [IPC_CHANNELS.DEEP_CLEAN_CACHE]: {
    args: []
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.FORCE_PASTE]: {
    args: [webContentsId: number]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.CHECK_FOR_UPDATES]: {
    args: []
    result: IpcResult<UpdateCheckResult>
  }

  [IPC_CHANNELS.OPEN_RELEASES]: {
    args: []
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.GET_APP_VERSION]: {
    args: []
    result: IpcResult<string>
  }

  // AI config / registry
  [IPC_CHANNELS.GET_AI_REGISTRY]: {
    args: [forceRefresh?: boolean]
    result: IpcResult<AiRegistryResponse>
  }

  [IPC_CHANNELS.SAVE_AI_CONFIG]: {
    args: [hostname: string, config: AiSelectorConfig]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.GET_AI_CONFIG]: {
    args: [hostname?: string]
    result: IpcResult<AiSelectorConfig | Record<string, AiSelectorConfig>>
  }

  [IPC_CHANNELS.DELETE_AI_CONFIG]: {
    args: [hostname: string]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.ADD_CUSTOM_AI]: {
    args: [data: CustomAiInput]
    result: IpcResult<CustomAiResult>
  }

  [IPC_CHANNELS.DELETE_CUSTOM_AI]: {
    args: [id: string]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.IS_AUTH_DOMAIN]: {
    args: [urlOrHostname: string]
    result: IpcResult<boolean>
  }

  // Automation script generator entrypoint (fan-out handled by main)
  [IPC_CHANNELS.GET_AUTOMATION_SCRIPTS]: {
    args: AutomationScriptInvokeArgs
    result: IpcResult<string>
  }

  // Gemini web session management
  [IPC_CHANNELS.GEMINI_WEB_STATUS]: {
    args: []
    result: IpcResult<GeminiWebSessionStatus>
  }

  [IPC_CHANNELS.GEMINI_WEB_OPEN_LOGIN]: {
    args: []
    result: IpcResult<GeminiWebSessionActionResult>
  }

  [IPC_CHANNELS.GEMINI_WEB_CHECK_NOW]: {
    args: []
    result: IpcResult<GeminiWebSessionActionResult>
  }

  [IPC_CHANNELS.GEMINI_WEB_REAUTH]: {
    args: []
    result: IpcResult<GeminiWebSessionActionResult>
  }

  [IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE]: {
    args: []
    result: IpcResult<GeminiWebSessionActionResult>
  }

  [IPC_CHANNELS.GEMINI_WEB_SET_ENABLED]: {
    args: [enabled: boolean]
    result: IpcResult<GeminiWebSessionActionResult>
  }

  [IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS]: {
    args: [enabledAppIds: GoogleWebSessionAppId[]]
    result: IpcResult<GeminiWebSessionActionResult>
  }

  [IPC_CHANNELS.GEMINI_WEB_EXPORT_SESSION]: {
    args: []
    result: IpcResult<{ success: boolean; error?: string }>
  }

  [IPC_CHANNELS.GEMINI_WEB_IMPORT_SESSION]: {
    args: []
    result: IpcResult<{ success: boolean; error?: string; status?: GeminiWebSessionStatus }>
  }

  // Native Messaging (Chrome Extension auth)
  [IPC_CHANNELS.NATIVE_MESSAGING_STATUS]: {
    args: []
    result: IpcResult<NativeMessagingExtensionInfo>
  }

  [IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION]: {
    args: []
    result: IpcResult<{ success: boolean; error?: string }>
  }

  [IPC_CHANNELS.NATIVE_MESSAGING_REMOVE_EXTENSION]: {
    args: []
    result: IpcResult<{ success: boolean; error?: string }>
  }

  [IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG]: {
    args: []
    result: IpcResult<{
      port: number
      host: string
      secret: string
      endpoints: { cookies: string; health: string }
    }>
  }
}

type CacheInfoBreakdown = {
  chromiumCache: number
  codeCache: number
  gpuCache: number
  partitionCaches: Record<string, number>
  tempFiles: number
  total: number
}

export type CacheInfoResponse = {
  breakdown: CacheInfoBreakdown
  lastCleanup: number | null
  lastCleanupResult: {
    filesDeleted: number
    bytesFreed: number
    errors: number
    duration: number
  } | null
  isIdle: boolean
}

export interface IpcEventMap {
  [IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_STARTED]: {
    args: [payload: GeminiWebSessionRefreshEvent]
  }
  [IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_SUCCESS]: {
    args: [payload: GeminiWebSessionRefreshEvent]
  }
  [IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_FAILED]: {
    args: [payload: GeminiWebSessionRefreshEvent]
  }
  [IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_CONNECTED]: {
    args: []
  }
  [IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_DISCONNECTED]: {
    args: []
  }
}

export type IpcInvokeChannel = keyof IpcInvokeRequestMap
export type IpcEventChannel = keyof IpcEventMap
export type AutomationScriptAction =
  | 'generateFocusScript'
  | 'generateClickSendScript'
  | 'generateAutoSendScript'
  | 'generateValidateSelectorsScript'
  | 'generateWaitForSubmitReadyScript'
  | 'generatePickerScript'

export type WaitForSubmitReadyOptions = {
  timeoutMs?: number
  settleMs?: number
  minimumWaitMs?: number
}

export type AutomationScriptArgsByAction = {
  generateFocusScript: [config: AutomationConfig]
  generateClickSendScript: [config: AutomationConfig]
  generateAutoSendScript: [
    config: AutomationConfig,
    text: string,
    submit: boolean,
    append?: boolean,
    textInputMode?: TextInputMode,
    typingSpeed?: number
  ]
  generateValidateSelectorsScript: [config: AutomationConfig]
  generateWaitForSubmitReadyScript: [config: AutomationConfig, options?: WaitForSubmitReadyOptions]
  generatePickerScript: [translations: Record<string, string>]
}

export type AutomationScriptInvokeArgs = {
  [A in AutomationScriptAction]: [action: A, ...args: AutomationScriptArgsByAction[A]]
}[AutomationScriptAction]

export interface ElectronApi {
  getAiRegistry: (forceRefresh?: boolean) => Promise<AiRegistryResponse | null>
  isAuthDomain: (url: string) => Promise<boolean>
  automation: {
    generateFocusScript: (config: AutomationConfig) => Promise<string | null>
    generateClickSendScript: (config: AutomationConfig) => Promise<string | null>
    generateAutoSendScript: (
      config: AutomationConfig,
      text: string,
      submit: boolean,
      append?: boolean,
      textInputMode?: TextInputMode,
      typingSpeed?: number
    ) => Promise<string | null>
    generateValidateSelectorsScript: (config: AutomationConfig) => Promise<string | null>
    generateWaitForSubmitReadyScript: (
      config: AutomationConfig,
      options?: WaitForSubmitReadyOptions
    ) => Promise<string | null>
    generatePickerScript: (translations: Record<string, string>) => Promise<string | null>
  }
  selectPdf: (options?: PdfSelectOptions) => Promise<PdfSelection | null>
  selectFolder: (options?: {
    title?: string
    defaultPath?: string
  }) => Promise<{ path: string } | null>
  getPdfStreamUrl: (filePath: string) => Promise<PdfStreamResult | null>
  registerPdfPath: (filePath: string) => Promise<PdfSelection | null>
  captureScreen: (rect?: {
    x: number
    y: number
    width: number
    height: number
  }) => Promise<string | null>
  copyImageToClipboard: (dataUrl: string) => Promise<boolean>
  copyTextToClipboard: (text: string) => Promise<boolean>
  openExternal: (url: string) => Promise<boolean>
  forcePaste: (webContentsId: number) => Promise<boolean>
  showPdfContextMenu: (labels: Partial<Record<string, string>>) => void
  onTriggerScreenshot: (callback: (type: ScreenshotType) => void) => () => void
  onPdfViewerZoom: (callback: (action: PdfViewerZoomAction) => void) => () => void
  platform: string
  quitApp: () => Promise<boolean>
  checkForUpdates: () => Promise<UpdateCheckResult>
  openReleasesPage: () => Promise<boolean>
  getAppVersion: () => Promise<string>
  clearCache: () => Promise<boolean>
  clearAiModelData: (input: ClearAiModelDataInput) => Promise<boolean>
  getCacheInfo: () => Promise<CacheInfoResponse>
  deepCleanCache: () => Promise<boolean>
  saveAiConfig: (hostname: string, config: AiSelectorConfig) => Promise<boolean>
  getAiConfig: (
    hostname?: string
  ) => Promise<AiSelectorConfig | Record<string, AiSelectorConfig> | null>
  deleteAiConfig: (hostname: string) => Promise<boolean>
  addCustomAi: (data: CustomAiInput) => Promise<CustomAiResult>
  deleteCustomAi: (id: string) => Promise<boolean>
  getApiChatConfig: () => Promise<ApiConfig | null>
  saveApiChatConfig: (config: ApiConfig) => Promise<boolean>
  cancelApiChatRequest: () => Promise<boolean>
  sendApiChatRequest: (
    messages: ApiChatMessage[],
    selectedModel?: string,
    generalPrompt?: string,
    providerId?: string
  ) => Promise<ApiChatMessage | null>
  fetchApiChatModels: (providerId: string) => Promise<string[] | null>
  geminiWeb: {
    getStatus: () => Promise<GeminiWebSessionStatus | null>
    openLogin: () => Promise<GeminiWebSessionActionResult>
    checkNow: () => Promise<GeminiWebSessionActionResult>
    reauth: () => Promise<GeminiWebSessionActionResult>
    resetProfile: () => Promise<GeminiWebSessionActionResult>
    setEnabled: (enabled: boolean) => Promise<GeminiWebSessionActionResult>
    setEnabledApps: (
      enabledAppIds: GoogleWebSessionAppId[]
    ) => Promise<GeminiWebSessionActionResult>
    exportSession: () => Promise<{ success: boolean; error?: string }>
    importSession: () => Promise<{
      success: boolean
      error?: string
      status?: GeminiWebSessionStatus
    }>
    onRefreshEvent: (callback: (event: GeminiWebSessionRefreshEvent) => void) => () => void
  }
  nativeMessaging: {
    getStatus: () => Promise<NativeMessagingExtensionInfo | null>
    installExtension: () => Promise<{ success: boolean; error?: string; installedPath?: string }>
    removeExtension: () => Promise<{ success: boolean; error?: string }>
    getBridgeConfig: () => Promise<{
      port: number
      host: string
      secret: string
      endpoints: { cookies: string; health: string }
    } | null>
    onExtensionConnected: (callback: () => void) => () => void
    onExtensionDisconnected: (callback: () => void) => () => void
  }

  /** Forward a log entry from the renderer to the main process buffer. */
  log: (level: string, message: string, timestamp: string) => void
}
