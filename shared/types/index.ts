/**
 * Shared Types - Single Source of Truth
 * These types are used by both electron (backend) and src (frontend)
 *
 * Each domain has its own file for maintainability.
 * Import from '@shared-core/types' as before — this barrel re-exports everything.
 */

export type { IpcError, IpcErrorCode, IpcResult } from '../lib/typedIpc'
export type {
  AiPlatform,
  AiPlatformMeta,
  AiRegistry,
  AiRegistryResponse,
  ClearAiModelDataInput,
  CustomAiInput,
  CustomAiResult,
  InactivePlatforms
} from './ai'
export type { ApiChatMessage, ApiConfig, ApiProviderConfig } from './apiChat'
export type {
  AiSelectorConfig,
  AutomationConfig,
  AutomationElementFingerprint,
  AutomationExecutionDiagnostics,
  AutomationExecutionResult,
  AutomationHostDescriptor,
  SelectorHealth,
  SubmitMode,
  TextInputMode
} from './automation'
export { TEXT_INPUT_MODE_VALUES } from './automation'
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
} from './gemini-web'
export type {
  CacheInfoResponse,
  ElectronApi,
  IpcInvokeChannel,
  IpcInvokeRequestMap
} from './ipcContract'
export type {
  ChromeExtensionCookie,
  NativeMessagingConnectionStatus,
  NativeMessagingExtensionInfo
} from './native-messaging'
export type {
  PdfFile,
  PdfSelection,
  PdfSelectOptions,
  PdfStreamResult,
  PdfViewerZoomAction
} from './pdf'
export type { ScreenshotType, UpdateCheckResult } from './system'
