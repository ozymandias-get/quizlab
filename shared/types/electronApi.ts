import type { GoogleWebSessionAppId } from '@shared-core/constants/googleAiWebApps'
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
import type {
  AiViewAttachRequest,
  AiViewAttachResponse,
  AiViewEvent,
  AiViewHostRequest,
  AiViewHostSyncRequest,
  AiViewIgnoreMouseRequest,
  AiViewInputEventRequest,
  AiViewLoadUrlRequest,
  AiViewNavigateRequest,
  AiViewScriptRequest,
  AiViewTabRequest,
  AiViewTextRequest
} from '@shared-core/types/aiView'

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
  smart?: {
    pressureLevel: 'normal' | 'moderate' | 'warning' | 'high' | 'critical'
    pressurePercentage: number
    recommendation: {
      action: string
      reason: string
      targetPartitions: string[]
      estimatedFreeBytes: number
    }
    partitionDetails: Array<{
      key: string
      size: number
      category: 'active' | 'passive' | 'cold'
      lastActive: number | null
      ttlMs: number
    }>
    autoClean: {
      enabled: boolean
      lastAutoCleanAt: number | null
    }
  }
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
  /** Explorer sağ-tık ile açılan PDF yolu için dinleyici (Windows). */
  onShellOpenPdf: (callback: (filePath: string) => void) => () => void
  shellIntegration: {
    getStatus: () => Promise<{
      supported: boolean
      installed: boolean
      label: string | null
      exePath: string | null
    } | null>
    install: (locale?: string) => Promise<{ success: boolean; error?: string }>
    remove: () => Promise<{ success: boolean; error?: string }>
  }
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
  setCacheAutoClean: (enabled: boolean) => Promise<boolean>
  smartCacheAction: (action: 'clean_cold' | 'clean_all') => Promise<boolean>
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
    exportSession: () => Promise<{ success: boolean; error?: string; detail?: string }>
    importSession: () => Promise<{
      success: boolean
      error?: string
      status?: GeminiWebSessionStatus
      warning?: string
      detail?: string
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
   * Remote site surfaces owned by the main process as `WebContentsView`s.
   *
   * Every entry point is keyed by a renderer-minted view id; the manager
   * resolves the partition, entry URL and `WebContents` from its own registry,
   * so the renderer can never address a `WebContents` it does not own.
   */
  aiView: {
    attach: (request: AiViewAttachRequest) => Promise<AiViewAttachResponse>
    detach: (request: AiViewHostRequest) => Promise<boolean>
    destroy: (request: AiViewTabRequest) => Promise<boolean>
    reload: (request: AiViewTabRequest) => Promise<boolean>
    loadUrl: (request: AiViewLoadUrlRequest) => Promise<boolean>
    navigate: (request: AiViewNavigateRequest) => Promise<boolean>
    getUrl: (request: AiViewTabRequest) => Promise<string | null>
    executeScript: (request: AiViewScriptRequest) => Promise<unknown>
    insertText: (request: AiViewTextRequest) => Promise<boolean>
    sendInputEvent: (request: AiViewInputEventRequest) => Promise<boolean>
    paste: (request: AiViewTabRequest) => Promise<boolean>
    focus: (request: AiViewTabRequest) => Promise<boolean>
    /**
     * Fire-and-forget geometry + visibility sync. Only the active host for a
     * view sends it; the main process dedupes identical rectangles and rejects
     * messages from a superseded host.
     */
    syncHost: (request: AiViewHostSyncRequest) => void
    /**
     * Mouse forwarding for the app while the bottom bar owns the pointer.
     * A native view cannot be shielded by a DOM overlay, so the ignore flag is
     * how the bar keeps working over the embedded site.
     */
    setIgnoreMouse: (request: AiViewIgnoreMouseRequest) => void
    onEvent: (callback: (event: AiViewEvent) => void) => () => void
  }

  /** Forward a log entry from the renderer to the main process buffer. */
  log: (level: string, message: string, timestamp: string) => void
}
