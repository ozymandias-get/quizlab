import type { IPC_CHANNELS } from '../constants/ipcChannels.js'
import type { IpcResult } from '../lib/typedIpc.js'
import type {
  AiRegistryResponse,
  ClearAiModelDataInput,
  CustomAiInput,
  CustomAiResult
} from './ai.js'
import type {
  AiViewAttachRequest,
  AiViewAttachResponse,
  AiViewEvent,
  AiViewHostRequest,
  AiViewHostSyncRequest,
  AiViewInputEventRequest,
  AiViewLoadUrlRequest,
  AiViewNavigateRequest,
  AiViewScriptRequest,
  AiViewTabRequest,
  AiViewTextRequest
} from './aiView.js'
import type { ApiChatMessage, ApiConfig } from './apiChat.js'
import type { AiSelectorConfig, AutomationConfig, TextInputMode } from './automation.js'
import type { CacheInfoResponse, WaitForSubmitReadyOptions } from './electronApi.js'
import type { NativeMessagingExtensionInfo } from './native-messaging.js'
import type { PdfSelection, PdfSelectOptions, PdfStreamResult, PdfViewerZoomAction } from './pdf.js'
import type { SiteSessionActionResult, SiteSessionListResult } from './siteSession.js'
import type { ScreenshotType, UpdateCheckResult } from './system.js'

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

  [IPC_CHANNELS.GET_PDF_STREAM_URL]: {
    args: [filePath: string]
    result: IpcResult<PdfStreamResult>
  }

  [IPC_CHANNELS.PDF_REGISTER_PATH]: {
    args: [filePath: string]
    result: IpcResult<PdfSelection>
  }

  [IPC_CHANNELS.SHELL_INTEGRATION_STATUS]: {
    args: []
    result: IpcResult<{
      supported: boolean
      installed: boolean
      label: string | null
      exePath: string | null
    }>
  }

  [IPC_CHANNELS.SHELL_INTEGRATION_INSTALL]: {
    args: [locale?: string]
    result: IpcResult<{ success: boolean; error?: string }>
  }

  [IPC_CHANNELS.SHELL_INTEGRATION_REMOVE]: {
    args: []
    result: IpcResult<{ success: boolean; error?: string }>
  }

  // Screenshot & clipboard
  [IPC_CHANNELS.CAPTURE_SCREEN]: {
    args: [rect?: { x: number; y: number; width: number; height: number }]
    result: IpcResult<string> // data URL
  }

  [IPC_CHANNELS.COPY_IMAGE]: {
    /**
     * `scope` is the clipboard-ownership key of one send transaction. All
     * copies of a multi-image send pass the same scope; the first copy pushes
     * the snapshot and exactly one RESTORE_CLIPBOARD(scope) releases it.
     * Omitted = legacy stack behaviour.
     */
    args: [dataUrl: string, scope?: string]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.RESTORE_CLIPBOARD]: {
    /** Releases the snapshot owned by `scope`; omitted = legacy pop-top. */
    args: [scope?: string]
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
    args: [requestId?: string]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.SEND_API_CHAT_REQUEST]: {
    args: [
      messages: ApiChatMessage[],
      selectedModel?: string,
      generalPrompt?: string,
      providerId?: string,
      requestId?: string
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

  [IPC_CHANNELS.SET_CACHE_AUTO_CLEAN]: {
    args: [enabled: boolean]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.SMART_CACHE_ACTION]: {
    args: [action: 'clean_cold' | 'clean_all']
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.CHECK_FOR_UPDATES]: {
    args: []
    result: IpcResult<UpdateCheckResult>
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

  // Automation script generator entrypoint (fan-out handled by main)
  [IPC_CHANNELS.GET_AUTOMATION_SCRIPTS]: {
    args: AutomationScriptInvokeArgs
    result: IpcResult<string>
  }

  // Remote site surface (main-process WebContentsView)
  [IPC_CHANNELS.AI_VIEW_ATTACH]: {
    args: [request: AiViewAttachRequest]
    result: IpcResult<AiViewAttachResponse>
  }

  [IPC_CHANNELS.AI_VIEW_DETACH]: {
    args: [request: AiViewHostRequest]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.AI_VIEW_DESTROY]: {
    args: [request: AiViewTabRequest]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.AI_VIEW_RELOAD]: {
    args: [request: AiViewTabRequest]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.AI_VIEW_LOAD_URL]: {
    args: [request: AiViewLoadUrlRequest]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.AI_VIEW_NAVIGATE]: {
    args: [request: AiViewNavigateRequest]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.AI_VIEW_GET_URL]: {
    args: [request: AiViewTabRequest]
    result: IpcResult<string | null>
  }

  [IPC_CHANNELS.AI_VIEW_EXECUTE_SCRIPT]: {
    args: [request: AiViewScriptRequest]
    result: IpcResult<unknown>
  }

  [IPC_CHANNELS.AI_VIEW_INSERT_TEXT]: {
    args: [request: AiViewTextRequest]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.AI_VIEW_SEND_INPUT_EVENT]: {
    args: [request: AiViewInputEventRequest]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.AI_VIEW_PASTE]: {
    args: [request: AiViewTabRequest]
    result: IpcResult<boolean>
  }

  [IPC_CHANNELS.AI_VIEW_FOCUS]: {
    args: [request: AiViewTabRequest]
    result: IpcResult<boolean>
  }

  // Site session management (per-site Chrome session import)
  [IPC_CHANNELS.SITE_SESSION_LIST]: {
    args: []
    result: IpcResult<SiteSessionListResult>
  }

  [IPC_CHANNELS.SITE_SESSION_SET_ENABLED]: {
    args: [siteId: string, enabled: boolean]
    result: IpcResult<SiteSessionActionResult>
  }

  [IPC_CHANNELS.SITE_SESSION_CLEAR]: {
    args: [siteId: string]
    result: IpcResult<SiteSessionActionResult>
  }

  // Account-level site session actions. Every one of them names the account it
  // acts on; the old site-level pair above is the primary account's alias.
  [IPC_CHANNELS.SITE_SESSION_SET_ACCOUNT_ENABLED]: {
    args: [siteId: string, accountId: string, enabled: boolean]
    result: IpcResult<SiteSessionActionResult>
  }

  [IPC_CHANNELS.SITE_SESSION_CLEAR_ACCOUNT]: {
    args: [siteId: string, accountId: string]
    result: IpcResult<SiteSessionActionResult>
  }

  [IPC_CHANNELS.SITE_SESSION_SET_ACTIVE_ACCOUNT]: {
    args: [siteId: string, accountId: string]
    result: IpcResult<SiteSessionActionResult>
  }

  [IPC_CHANNELS.SITE_SESSION_RENAME_ACCOUNT]: {
    args: [siteId: string, accountId: string, name: string]
    result: IpcResult<SiteSessionActionResult>
  }

  [IPC_CHANNELS.SITE_SESSION_DELETE_ACCOUNT]: {
    args: [siteId: string, accountId: string]
    result: IpcResult<SiteSessionActionResult>
  }

  [IPC_CHANNELS.SITE_SESSION_RESOLVE_PENDING]: {
    args: [siteId: string, accountId: string | null]
    result: IpcResult<SiteSessionActionResult>
  }

  // App settings sync (renderer localStorage <-> main ConfigManager)
  [IPC_CHANNELS.GET_APP_SETTINGS]: {
    args: []
    result: IpcResult<Record<string, string>>
  }

  [IPC_CHANNELS.SAVE_APP_SETTINGS]: {
    args: [key: string, value: string]
    result: IpcResult<boolean>
  }

  // Native Messaging (Chrome Extension auth)
  [IPC_CHANNELS.NATIVE_MESSAGING_STATUS]: {
    args: []
    result: IpcResult<NativeMessagingExtensionInfo>
  }

  [IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION]: {
    args: []
    result: IpcResult<{ success: boolean; error?: string; installedPath?: string }>
  }

  [IPC_CHANNELS.NATIVE_MESSAGING_REMOVE_EXTENSION]: {
    args: []
    result: IpcResult<{ success: boolean; error?: string }>
  }
}

export interface IpcEventMap {
  [IPC_CHANNELS.SITE_SESSION_CHANGED]: {
    args: [result: SiteSessionListResult]
  }
  [IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_CONNECTED]: {
    args: []
  }
  [IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_DISCONNECTED]: {
    args: []
  }
  [IPC_CHANNELS.AI_VIEW_SYNC_HOST]: {
    args: [request: AiViewHostSyncRequest]
  }
  [IPC_CHANNELS.AI_VIEW_EVENT]: {
    args: [event: AiViewEvent]
  }
  // Event-style channels (main → renderer) not using invoke
  [IPC_CHANNELS.OPEN_PDF_FROM_SHELL]: {
    args: [filePath: string]
  }
  [IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU]: {
    args: [labels: Partial<Record<string, string>>]
  }
  [IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM]: {
    args: [action: PdfViewerZoomAction]
  }
  [IPC_CHANNELS.TRIGGER_SCREENSHOT]: {
    args: [type: ScreenshotType]
  }
  [IPC_CHANNELS.LOGGER_LOG]: {
    args: [payload: { level: string; message: string; timestamp?: string }]
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
  generatePickerScript: [translations: Record<string, string>, sessionId?: string]
}

export type AutomationScriptInvokeArgs = {
  [A in AutomationScriptAction]: [action: A, ...args: AutomationScriptArgsByAction[A]]
}[AutomationScriptAction]

export type { CacheInfoResponse, ElectronApi } from './electronApi.js'
