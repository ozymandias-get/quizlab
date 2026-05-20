export type PipelineStage =
  | 'queue'
  | 'config_resolve'
  | 'clipboard'
  | 'paste'
  | 'focus'
  | 'script_generation'
  | 'script_execution'
  | 'submit_ready'
  | 'click'
  | 'complete'
  | 'error'

export type DiagnosticsEventType =
  | 'SEND_START'
  | 'SEND_SUCCESS'
  | 'SEND_ERROR'
  | 'SEND_FAILED'
  | 'SEND_TIMEOUT'
  | 'CLIPBOARD_SUCCESS'
  | 'CLIPBOARD_FAILED'
  | 'PASTE_SUCCESS'
  | 'PASTE_FAILED'
  | 'SCRIPT_GENERATED'
  | 'SUBMIT_READY'
  | 'CONFIG_RESOLVED'
  | 'PIPELINE_ERROR'
  | 'PIPELINE_TIMEOUT'
  | 'IMAGE_UPLOAD_SUCCESS'
  | 'IMAGE_UPLOAD_FAILED'
  | 'IMAGE_UPLOAD_START'
  | 'PROVIDER_DEGRADED'
  | 'WEBVIEW_READY'
  | 'WEBVIEW_DESTROYED'
  | 'WEBVIEW_CRASH'
  | 'EXECUTE_JS_SUCCESS'
  | 'EXECUTE_JS_FAILED'
  | 'SELECTOR_RECOVERED'
  | 'SELECTOR_RECOVERY_FAILED'
  | 'SELECTOR_PRIMARY_FAILED'
  | 'FALLBACK_ACTIVATED'
  | 'FALLBACK_APPLIED'
  | 'FALLBACK_REJECTED'
  | 'AUTOMATION_SUCCESS'
  | 'AUTOMATION_FAILED'
  | 'PROVIDER_CACHE_HIT'
  | 'PROVIDER_CACHE_MISS'
  | 'SELECTOR_FALLBACK_USED'
  | 'SELECTOR_SELF_HEALED'
  | 'RECOVERY_TRIGGERED'
  | 'RECOVERY_SUCCESS'

export type DiagnosticsSeverity = 'info' | 'warn' | 'error'

export type DiagnosticsEventSource = 'webview' | 'automation' | 'provider' | 'pipeline'

export interface DiagnosticsEvent {
  id: string
  timestamp: number
  type: DiagnosticsEventType
  provider: string
  severity: DiagnosticsSeverity
  pipelineStage: PipelineStage
  duration?: number
  message?: string
  retryCount?: number
  timedOut?: boolean
  selectorUsed?: string
  selectorFallback?: boolean
  confidenceScore?: number
  fallbackStrategy?: string
  candidateCount?: number
  cacheStatus?: 'hit' | 'miss' | 'stale'
  source?: DiagnosticsEventSource
}

export type ProviderHealthSignalType =
  | 'timeout'
  | 'failed_send'
  | 'send_latency'
  | 'selector_recovery'
  | 'execute_js_error'
  | 'stale_webview'
  | 'readiness_failure'
  | 'upload_failure'

export interface ProviderHealthSignal {
  type: ProviderHealthSignalType
  timestamp: number
  provider: string
  weight?: number
}

export type ProviderHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY'
  | 'SLOW'
  | 'SELECTOR_BROKEN'
  | 'LOGIN_REQUIRED'
  | 'RATE_LIMITED'
  | 'WEBVIEW_UNRESPONSIVE'
  | 'UNKNOWN'

export interface ProviderHealthState {
  status: ProviderHealthStatus
  lastSignal: number
  lastUpdated: number
  signalCount: number
  degradedSince?: number
  degradedReason?: string
  consecutiveErrors: number
  averageLatency: number
  score: number
  signals: ProviderHealthSignal[]
}

export interface WebviewDebugState {
  activeWebviewId: string | null
  currentProvider: string | null
  visible: boolean
  ready: boolean
  frozen: boolean
  automationLocked: boolean
  queueBlocked: boolean
  activeSelectorStrategy: string | null
  fallbackActive: boolean
  lastExecuteJsDuration: number | null
}

export interface TelemetryMetrics {
  averageSendDuration: number
  providerLatency: Record<string, number>
  selectorRecoveryRate: number
  failedSendRatio: number
  retryCount: number
  timeoutCount: number
  cacheHitRatio: number
  fallbackUsageRatio: number
  uploadSuccessRatio: number
  webviewCrashCount: number
  recoverySuccessRatio: number
  totalSends: number
  successfulSends: number
  failedSends: number
  executeJsErrorCount: number
  staleWebviewCount: number
}

export interface GroupedError {
  message: string
  count: number
  lastSeen: number
  firstSeen: number
  providers: string[]
  provider?: string
  pipelineStages: PipelineStage[]
  pipelineStage?: PipelineStage
  type: DiagnosticsEventType
  severity: DiagnosticsSeverity
}

export interface DiagnosticsState {
  enabled: boolean
  showPanel: boolean
  verboseLogging: boolean
  autoOpenOnError: boolean
  events: DiagnosticsEvent[]
  lastError: string | null
  lastSuccess: number | null
  providerDegraded: boolean
  currentProvider: string | null
  queueSize: number
  webviewReady: boolean
  performanceMode: 'normal' | 'lightweight'
  totalSends: number
  averageSendTime: number
  providerHealth: Record<string, ProviderHealthState>
  groupedErrors: GroupedError[]
  metrics: TelemetryMetrics
  panelOpen: boolean
  autoOpenTriggered: boolean
  webviewState: WebviewDebugState
  lastPipelineEvents: Record<string, DiagnosticsEvent>
}

export interface DiagnosticsSnapshot {
  appVersion: string
  platform: string
  timestamp: number
  providerState: {
    currentProvider: string | null
    providerDegraded: boolean
    totalSends: number
    averageSendTime: number
    health: Record<string, ProviderHealthState>
  }
  queueState: {
    queueSize: number
    webviewReady: boolean
  }
  timingSummary: {
    lastSendTime: number | null
    averageSendTime: number
    totalSends: number
    providerLatency: Record<string, number>
  }
  metrics: TelemetryMetrics
  lastError: string | null
  groupedErrors: GroupedError[]
  events: DiagnosticsEvent[]
  settings: {
    enabled: boolean
    verboseLogging: boolean
    autoOpenOnError: boolean
    performanceMode: 'normal' | 'lightweight'
  }
  webviewState: WebviewDebugState
}

export const MAX_DIAGNOSTICS_EVENTS = 1000
export const MAX_DIAGNOSTICS_EVENTS_LIGHTWEIGHT = 200
export const EVENT_PRUNE_THRESHOLD = 50
export const ERROR_GROUP_WINDOW_MS = 60_000
export const HEALTH_SIGNAL_TTL_MS = 300_000
export const HEALTH_DEGRADED_THRESHOLD = 3
export const HEALTH_SLOW_THRESHOLD_MS = 5000
