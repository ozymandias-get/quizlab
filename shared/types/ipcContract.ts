import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'
import type {
  DoclingInstallProgressEvent,
  DoclingModelProgressEvent,
  DoclingModelStatusInfo,
  DoclingServiceStatus,
  QuizLabConversionTask,
  QuizLabDocument
} from '@shared-core/types'
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
  TextInputMode,
  UpdateCheckResult
} from '@shared-core/types'
import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import type { IPC_CHANNELS } from '../constants/ipc-channels.js'
import type { IpcResult } from '../lib/typedIpc.js'
import type { CacheInfoResponse, WaitForSubmitReadyOptions } from './electronApi.js'

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

  [IPC_CHANNELS.RESTORE_CLIPBOARD]: {
    args: []
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
      endpoints: { cookies: string; health: string }
    }>
  }

  // Optional Component Manager (installable features, e.g. Docling)
  [IPC_CHANNELS.OPTIONAL_COMPONENTS_LIST]: {
    args: []
    result: IpcResult<OptionalComponentInfo[]>
  }

  [IPC_CHANNELS.OPTIONAL_COMPONENTS_GET_STATE]: {
    args: [componentId: string]
    result: IpcResult<OptionalComponentInfo | null>
  }

  [IPC_CHANNELS.OPTIONAL_COMPONENTS_RUN_ACTION]: {
    args: [componentId: string, action: OptionalComponentAction]
    result: IpcResult<OptionalComponentActionResult>
  }

  [IPC_CHANNELS.DOCLING_SERVICE_GET_STATUS]: {
    args: []
    result: IpcResult<DoclingServiceStatus>
  }

  [IPC_CHANNELS.DOCLING_SERVICE_ENSURE_RUNNING]: {
    args: []
    result: IpcResult<DoclingServiceStatus>
  }

  [IPC_CHANNELS.DOCLING_SERVICE_STOP]: {
    args: []
    result: IpcResult<DoclingServiceStatus>
  }

  [IPC_CHANNELS.DOCLING_SERVICE_RESTART]: {
    args: []
    result: IpcResult<DoclingServiceStatus>
  }

  [IPC_CHANNELS.DOCLING_SERVICE_HEALTH_CHECK]: {
    args: []
    result: IpcResult<{ healthy: boolean; detail?: string }>
  }

  [IPC_CHANNELS.DOCLING_CONVERT]: {
    args: [pdfPath: string]
    result: IpcResult<QuizLabConversionTask>
  }

  [IPC_CHANNELS.DOCLING_CONVERT_STATUS]: {
    args: [taskId: string]
    result: IpcResult<QuizLabConversionTask>
  }

  [IPC_CHANNELS.DOCLING_CONVERT_RESULT]: {
    args: [taskId: string]
    result: IpcResult<QuizLabDocument>
  }

  [IPC_CHANNELS.DOCLING_CONVERT_CANCEL]: {
    args: [taskId: string]
    result: IpcResult<QuizLabConversionTask>
  }

  [IPC_CHANNELS.DOCLING_CONVERT_REPROCESS]: {
    args: [pdfPath: string]
    result: IpcResult<QuizLabConversionTask>
  }

  [IPC_CHANNELS.DOCLING_MODELS_GET_STATUS]: {
    args: []
    result: IpcResult<DoclingModelStatusInfo>
  }

  [IPC_CHANNELS.DOCLING_MODELS_DOWNLOAD]: {
    args: []
    result: IpcResult<DoclingModelStatusInfo>
  }

  [IPC_CHANNELS.DOCLING_MODELS_DELETE]: {
    args: []
    result: IpcResult<DoclingModelStatusInfo>
  }

  [IPC_CHANNELS.DOCLING_MODELS_REPAIR]: {
    args: []
    result: IpcResult<DoclingModelStatusInfo>
  }

  [IPC_CHANNELS.DOCLING_MODELS_GET_DISK_USAGE]: {
    args: []
    result: IpcResult<number>
  }

  [IPC_CHANNELS.DOCLING_GPU_GET_PREFS]: {
    args: []
    result: IpcResult<{ enabled: boolean; lastDetected?: string }>
  }

  [IPC_CHANNELS.DOCLING_GPU_SET_ENABLED]: {
    args: [enabled: boolean]
    result: IpcResult<{ enabled: boolean; lastDetected?: string }>
  }

  [IPC_CHANNELS.DOCLING_GPU_DETECT]: {
    args: []
    result: IpcResult<{ device: string; available: boolean; detail?: string }>
  }

  [IPC_CHANNELS.DOCLING_GPU_INSTALL_CUDA]: {
    args: []
    result: IpcResult<{ success: boolean; detail?: string }>
  }
}

export interface IpcEventMap {
  [IPC_CHANNELS.DOCLING_INSTALL_PROGRESS]: {
    args: [payload: DoclingInstallProgressEvent]
  }
  [IPC_CHANNELS.DOCLING_MODELS_PROGRESS]: {
    args: [payload: DoclingModelProgressEvent]
  }
  [IPC_CHANNELS.DOCLING_SERVICE_STATUS_CHANGED]: {
    args: [payload: DoclingServiceStatus]
  }
  [IPC_CHANNELS.DOCLING_CONVERT_PROGRESS]: {
    args: [payload: QuizLabConversionTask]
  }
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

export type { CacheInfoResponse, ElectronApi, WaitForSubmitReadyOptions } from './electronApi.js'
