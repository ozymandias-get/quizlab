import { IPC_CHANNELS } from '../constants/ipc-channels'
import type {
  AiRegistryResponse,
  AiSelectorConfig,
  AutomationConfig,
  CustomAiInput,
  CustomAiResult,
  GeminiWebSessionActionResult,
  GeminiWebSessionStatus,
  PdfSelectOptions,
  PdfSelection,
  PdfStreamResult,
  PdfViewerZoomAction,
  ScreenshotType,
  UpdateCheckResult
} from '@shared-core/types'
import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

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

export type IpcChannelValue = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface IpcInvokeRequestMap {
  // PDF selection / streaming
  [IPC_CHANNELS.SELECT_PDF]: {
    args: [options?: PdfSelectOptions]
    result: PdfSelection | null
  }

  [IPC_CHANNELS.GET_PDF_STREAM_URL]: {
    args: [filePath: string]
    result: PdfStreamResult | null
  }

  [IPC_CHANNELS.PDF_REGISTER_PATH]: {
    args: [filePath: string]
    result: PdfSelection | null
  }

  // Screenshot & clipboard
  [IPC_CHANNELS.CAPTURE_SCREEN]: {
    args: [rect?: { x: number; y: number; width: number; height: number }]
    result: string | null // data URL
  }

  [IPC_CHANNELS.COPY_IMAGE]: {
    args: [dataUrl: string]
    result: boolean
  }

  [IPC_CHANNELS.COPY_TEXT]: {
    args: [text: string]
    result: boolean
  }

  // Shell / system helpers
  [IPC_CHANNELS.OPEN_EXTERNAL]: {
    args: [url: string]
    result: boolean
  }

  [IPC_CHANNELS.APP_QUIT]: {
    args: []
    result: void
  }

  [IPC_CHANNELS.CLEAR_CACHE]: {
    args: []
    result: boolean
  }

  [IPC_CHANNELS.FORCE_PASTE]: {
    args: [webContentsId: number]
    result: boolean
  }

  [IPC_CHANNELS.CHECK_FOR_UPDATES]: {
    args: []
    result: UpdateCheckResult
  }

  [IPC_CHANNELS.OPEN_RELEASES]: {
    args: []
    result: void
  }

  [IPC_CHANNELS.GET_APP_VERSION]: {
    args: []
    result: string
  }

  // AI config / registry
  [IPC_CHANNELS.GET_AI_REGISTRY]: {
    args: [forceRefresh?: boolean]
    result: AiRegistryResponse
  }

  [IPC_CHANNELS.SAVE_AI_CONFIG]: {
    args: [hostname: string, config: AiSelectorConfig]
    result: boolean
  }

  [IPC_CHANNELS.GET_AI_CONFIG]: {
    args: [hostname?: string]
    result: AiSelectorConfig | Record<string, AiSelectorConfig> | null
  }

  [IPC_CHANNELS.DELETE_AI_CONFIG]: {
    args: [hostname: string]
    result: boolean
  }

  [IPC_CHANNELS.ADD_CUSTOM_AI]: {
    args: [data: CustomAiInput]
    result: CustomAiResult
  }

  [IPC_CHANNELS.DELETE_CUSTOM_AI]: {
    args: [id: string]
    result: boolean
  }

  [IPC_CHANNELS.IS_AUTH_DOMAIN]: {
    args: [urlOrHostname: string]
    result: boolean
  }

  // Automation script generator entrypoint (fan-out handled by main)
  [IPC_CHANNELS.GET_AUTOMATION_SCRIPTS]: {
    args: AutomationScriptInvokeArgs
    result: string | null
  }

  // Gemini web session management
  [IPC_CHANNELS.GEMINI_WEB_STATUS]: {
    args: []
    result: GeminiWebSessionStatus
  }

  [IPC_CHANNELS.GEMINI_WEB_OPEN_LOGIN]: {
    args: []
    result: GeminiWebSessionActionResult
  }

  [IPC_CHANNELS.GEMINI_WEB_CHECK_NOW]: {
    args: []
    result: GeminiWebSessionActionResult
  }

  [IPC_CHANNELS.GEMINI_WEB_REAUTH]: {
    args: []
    result: GeminiWebSessionActionResult
  }

  [IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE]: {
    args: []
    result: GeminiWebSessionActionResult
  }

  [IPC_CHANNELS.GEMINI_WEB_SET_ENABLED]: {
    args: [enabled: boolean]
    result: GeminiWebSessionActionResult
  }

  [IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS]: {
    args: [enabledAppIds: GoogleWebSessionAppId[]]
    result: GeminiWebSessionActionResult
  }
}

export type IpcInvokeChannel = keyof IpcInvokeRequestMap
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
    append?: boolean
  ]
  generateValidateSelectorsScript: [config: AutomationConfig]
  generateWaitForSubmitReadyScript: [config: AutomationConfig, options?: WaitForSubmitReadyOptions]
  generatePickerScript: [translations: Record<string, string>]
}

export type AutomationScriptInvokeArgs = {
  [A in AutomationScriptAction]: [action: A, ...args: AutomationScriptArgsByAction[A]]
}[AutomationScriptAction]

export interface ElectronApi {
  getAiRegistry: (forceRefresh?: boolean) => Promise<AiRegistryResponse>
  isAuthDomain: (url: string) => Promise<boolean>
  automation: {
    generateFocusScript: (config: AutomationConfig) => Promise<string | null>
    generateClickSendScript: (config: AutomationConfig) => Promise<string | null>
    generateAutoSendScript: (
      config: AutomationConfig,
      text: string,
      submit: boolean,
      append?: boolean
    ) => Promise<string | null>
    generateValidateSelectorsScript: (config: AutomationConfig) => Promise<string | null>
    generateWaitForSubmitReadyScript: (
      config: AutomationConfig,
      options?: WaitForSubmitReadyOptions
    ) => Promise<string | null>
    generatePickerScript: (translations: Record<string, string>) => Promise<string | null>
  }
  selectPdf: (options?: PdfSelectOptions) => Promise<PdfSelection | null>
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
  quitApp: () => Promise<void>
  checkForUpdates: () => Promise<UpdateCheckResult>
  openReleasesPage: () => Promise<void>
  getAppVersion: () => Promise<string>
  clearCache: () => Promise<boolean>
  saveAiConfig: (hostname: string, config: AiSelectorConfig) => Promise<boolean>
  getAiConfig: (
    hostname?: string
  ) => Promise<AiSelectorConfig | Record<string, AiSelectorConfig> | null>
  deleteAiConfig: (hostname: string) => Promise<boolean>
  addCustomAi: (data: CustomAiInput) => Promise<CustomAiResult>
  deleteCustomAi: (id: string) => Promise<boolean>
  geminiWeb: {
    getStatus: () => Promise<GeminiWebSessionStatus>
    openLogin: () => Promise<GeminiWebSessionActionResult>
    checkNow: () => Promise<GeminiWebSessionActionResult>
    reauth: () => Promise<GeminiWebSessionActionResult>
    resetProfile: () => Promise<GeminiWebSessionActionResult>
    setEnabled: (enabled: boolean) => Promise<GeminiWebSessionActionResult>
    setEnabledApps: (
      enabledAppIds: GoogleWebSessionAppId[]
    ) => Promise<GeminiWebSessionActionResult>
  }
}
