import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'
import type { DoclingInstallProgressEvent } from '@shared-core/types'
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
  OptionalComponentAction,
  OptionalComponentActionResult,
  OptionalComponentInfo,
  PdfSelection,
  PdfSelectOptions,
  PdfStreamResult,
  PdfViewerZoomAction,
  ScreenshotType,
  TextInputMode,
  UpdateCheckResult
} from '@shared-core/types'
import type { NativeMessagingExtensionInfo } from '@shared-core/types'

export type CacheInfoResponse = {
  breakdown: {
    chromiumCache: number
    codeCache: number
    gpuCache: number
    partitionCaches: Record<string, number>
    tempFiles: number
    total: number
  }
  lastCleanup: number | null
  lastCleanupResult: {
    filesDeleted: number
    bytesFreed: number
    errors: number
    duration: number
  } | null
  isIdle: boolean
}

export type WaitForSubmitReadyOptions = {
  timeoutMs?: number
  settleMs?: number
  minimumWaitMs?: number
}

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
  /** Restore the clipboard contents that were replaced by copyImageToClipboard. */
  restoreClipboard: () => Promise<boolean>
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
  /** Read all synced app settings (localStorage mirror) from the main process store. */
  getAppSettings: () => Promise<Record<string, string> | null>
  /** Persist a single synced setting in the main process store. */
  saveAppSetting: (key: string, value: string) => Promise<boolean>
  getApiChatConfig: () => Promise<ApiConfig | null>
  saveApiChatConfig: (config: ApiConfig) => Promise<boolean>
  /** Abort one in-flight chat request by id, or every active request when omitted. */
  cancelApiChatRequest: (requestId?: string) => Promise<boolean>
  sendApiChatRequest: (
    messages: ApiChatMessage[],
    selectedModel?: string,
    generalPrompt?: string,
    providerId?: string,
    requestId?: string
  ) => Promise<ApiChatMessage | null>
  fetchApiChatModels: (providerId: string) => Promise<string[] | null>
  geminiWeb: {
    getStatus: () => Promise<GeminiWebSessionStatus | null>

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
      endpoints: { cookies: string; health: string }
    } | null>
    onExtensionConnected: (callback: () => void) => () => void
    onExtensionDisconnected: (callback: () => void) => () => void
  }
  /**
   * Optional Component Manager. Installable features (e.g. Docling) are
   * addressed by whitelisted id only — the renderer never passes paths,
   * commands or arbitrary payloads.
   */
  optionalComponents: {
    /** All registered components with their current persisted state. */
    list: () => Promise<OptionalComponentInfo[]>
    /** One component's state; null when the id is not whitelisted. */
    getState: (componentId: string) => Promise<OptionalComponentInfo | null>
    /**
     * Run a lifecycle action. Domain-level failures (e.g. a failed download)
     * resolve with success:false plus the updated component state; transport
     * errors (unknown component, invalid transition) reject.
     */
    runAction: (
      componentId: string,
      action: OptionalComponentAction
    ) => Promise<OptionalComponentActionResult>
  }

  /**
   * Subscribe to Docling installer progress broadcasts (install/repair
   * pipeline stages). Returns an unsubscribe function.
   */
  onDoclingInstallProgress: (callback: (event: DoclingInstallProgressEvent) => void) => () => void

  /** Forward a log entry from the renderer to the main process buffer. */
  log: (level: string, message: string, timestamp: string) => void
}
