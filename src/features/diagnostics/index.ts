export { useDiagnosticsStore } from './store/diagnosticsStore'
export { default as DiagnosticsTab } from './ui/DiagnosticsTab'
export type {
  PipelineStage,
  DiagnosticsEventType,
  DiagnosticsSeverity,
  DiagnosticsEvent,
  DiagnosticsState,
  DiagnosticsSnapshot,
  ProviderHealthSignal,
  ProviderHealthState,
  ProviderHealthStatus,
  WebviewDebugState,
  TelemetryMetrics,
  GroupedError,
  DiagnosticsEventSource
} from './model/types'
export {
  MAX_DIAGNOSTICS_EVENTS,
  MAX_DIAGNOSTICS_EVENTS_LIGHTWEIGHT,
  EVENT_PRUNE_THRESHOLD,
  ERROR_GROUP_WINDOW_MS,
  HEALTH_SIGNAL_TTL_MS,
  HEALTH_DEGRADED_THRESHOLD,
  HEALTH_SLOW_THRESHOLD_MS
} from './model/types'
