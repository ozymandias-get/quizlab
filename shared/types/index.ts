/**
 * Shared Types - Single Source of Truth
 * These types are used by both electron (backend) and src (frontend)
 *
 * Each domain has its own file for maintainability.
 * Import from '@shared-core/types' as before — this barrel re-exports everything.
 */

export type {
  SubmitMode,
  SelectorHealth,
  AutomationHostDescriptor,
  AutomationElementFingerprint,
  AiSelectorConfig,
  AutomationConfig,
  AutomationLookupStrategy,
  ConfidenceLevel,
  AutomationSelectorDiagnostics,
  AutomationExecutionDiagnostics,
  AutomationExecutionResult
} from './automation'

export type {
  AiPlatformMeta,
  AiPlatform,
  AiRegistry,
  InactivePlatforms,
  AiRegistryResponse,
  CustomAiInput,
  CustomAiPayload,
  CustomAiResult,
  ClearAiModelDataInput
} from './ai'

export type { IpcError, IpcErrorCode, IpcResult } from './ipc'
export type { ElectronApi, IpcInvokeRequestMap, IpcInvokeChannel } from './ipcContract'

export type {
  PdfSelectOptions,
  PdfSelection,
  PdfStreamResult,
  PdfFile,
  PdfViewerZoomAction
} from './pdf'

export type { ApiConfig, ApiProviderConfig, ApiChatMessage } from './apiChat'

export type { UpdateCheckResult, ScreenshotType } from './system'

export type {
  GeminiWebSessionState,
  GeminiWebSessionReasonCode,
  GeminiWebSessionStatus,
  GeminiWebSessionConfig,
  GeminiWebSessionActionResult,
  HealthCheckResult,
  SessionActionLike,
  GeminiWebSessionRefreshReason,
  GeminiWebSessionRefreshPhase,
  GeminiWebSessionRefreshEvent
} from './gemini-web'
