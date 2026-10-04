/**
 * Shared Types - Single Source of Truth
 * These types are used by both electron (backend) and src (frontend)
 *
 * Each domain has its own file for maintainability.
 * Import from '@shared-core/types' as before — this barrel re-exports everything.
 */

export type { IpcError, IpcErrorCode, IpcResult } from '../lib/typedIpc.js'
export type {
  AiPlatform,
  AiPlatformMeta,
  AiRegistry,
  AiRegistryResponse,
  ClearAiModelDataInput,
  CustomAiInput,
  CustomAiResult,
  InactivePlatforms
} from './ai.js'
export type { AiContentController, AiContentRef } from './aiContent.js'
export type {
  AiContentInputEvent,
  AiContentInputEventType,
  AiViewAttachRequest,
  AiViewAttachResponse,
  AiViewBounds,
  AiViewEvent,
  AiViewEventKind,
  AiViewEventOf,
  AiViewHostRequest,
  AiViewHostSurface,
  AiViewHostSyncRequest,
  AiViewInputEventRequest,
  AiViewLoadUrlRequest,
  AiViewNavigateRequest,
  AiViewScriptRequest,
  AiViewSource,
  AiViewTabRequest,
  AiViewTextRequest
} from './aiView.js'
export type { ApiChatMessage, ApiConfig, ApiProviderConfig } from './apiChat.js'
export type {
  AiSelectorConfig,
  AutomationConfig,
  AutomationElementFingerprint,
  AutomationExecutionDiagnostics,
  AutomationExecutionResult,
  AutomationHostDescriptor,
  AutomationLookupStrategy,
  AutomationSelectorDiagnostics,
  ConfidenceLevel,
  SelectorHealth,
  SelectorLastRepair,
  SelectorRepairCandidate,
  SelectorRepairKind,
  SelectorRepairReason,
  SelectorRepairState,
  SubmitMode,
  TextInputMode
} from './automation.js'
export { TEXT_INPUT_MODE_VALUES } from './automation.js'
export type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionReasonCode,
  GeminiWebSessionRefreshEvent,
  GeminiWebSessionRefreshReason,
  GeminiWebSessionState,
  GeminiWebSessionStatus,
  HealthCheckResult,
  SessionActionLike
} from './gemini-web.js'
export type {
  CacheInfoResponse,
  ElectronApi,
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from './ipcContract.js'
export type {
  ChromeExtensionCookie,
  NativeMessagingConnectionStatus,
  NativeMessagingExtensionInfo
} from './native-messaging.js'
export type {
  PdfFile,
  PdfSelection,
  PdfSelectOptions,
  PdfStreamResult,
  PdfViewerZoomAction
} from './pdf.js'
export type { ScreenshotType, UpdateCheckResult } from './system.js'
