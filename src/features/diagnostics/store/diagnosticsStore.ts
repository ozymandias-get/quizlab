import { create } from 'zustand'
import type {
  DiagnosticsEvent,
  DiagnosticsEventType,
  DiagnosticsSeverity,
  DiagnosticsSnapshot,
  DiagnosticsState,
  PipelineStage,
  ProviderHealthSignal
} from '../model/types'
import {
  MAX_DIAGNOSTICS_EVENTS,
  MAX_DIAGNOSTICS_EVENTS_LIGHTWEIGHT,
  EVENT_PRUNE_THRESHOLD
} from '../model/types'
import { computeTelemetryMetrics, resetMetricsCache } from '../lib/telemetryMetrics'
import { updateProviderHealth, computeProviderHealthFromEvents } from '../lib/providerHealth'
import { groupErrors } from '../lib/errorGrouping'
import { createSafeExport } from '../lib/exportSanitization'

let eventCounter = 0

function generateEventId(): string {
  return `diag_${Date.now()}_${++eventCounter}`
}

function pruneEvents(events: DiagnosticsEvent[], maxEvents: number): DiagnosticsEvent[] {
  if (events.length <= maxEvents) return events
  const toRemove = events.length - maxEvents + EVENT_PRUNE_THRESHOLD
  return events.slice(toRemove)
}

function getSourceForEvent(type: DiagnosticsEventType): DiagnosticsEvent['source'] {
  if (type.includes('WEBVIEW') || type.includes('EXECUTE_JS')) return 'webview'
  if (type.includes('SELECTOR') || type.includes('FALLBACK') || type.includes('AUTOMATION'))
    return 'automation'
  if (type.includes('PROVIDER') || type.includes('CACHE')) return 'provider'
  return 'pipeline'
}

interface DiagnosticsStore extends DiagnosticsState {
  emitEvent: (params: {
    type: DiagnosticsEventType
    provider: string
    severity?: DiagnosticsSeverity
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
  }) => void

  setEnabled: (enabled: boolean) => void
  setShowPanel: (showPanel: boolean) => void
  setVerboseLogging: (verbose: boolean) => void
  setAutoOpenOnError: (autoOpen: boolean) => void
  setProviderDegraded: (degraded: boolean) => void
  setCurrentProvider: (provider: string | null) => void
  setQueueSize: (size: number) => void
  setWebviewReady: (ready: boolean) => void
  setPerformanceMode: (mode: 'normal' | 'lightweight') => void
  recordSend: (duration: number, success: boolean) => void
  setLastError: (error: string | null) => void
  clearEvents: () => void
  reset: () => void
  exportSnapshot: (appVersion: string, platform: string) => Record<string, unknown>
  setPanelOpen: (open: boolean) => void
  setAutoOpenTriggered: (triggered: boolean) => void
  updateWebviewState: (partial: Partial<DiagnosticsState['webviewState']>) => void
  recordHealthSignal: (signal: ProviderHealthSignal) => void
}

export const useDiagnosticsStore = create<DiagnosticsStore>((set, get) => ({
  enabled: false,
  showPanel: true,
  verboseLogging: false,
  autoOpenOnError: false,
  events: [],
  lastError: null,
  lastSuccess: null,
  providerDegraded: false,
  currentProvider: null,
  queueSize: 0,
  webviewReady: false,
  performanceMode: 'normal',
  totalSends: 0,
  averageSendTime: 0,
  providerHealth: {},
  groupedErrors: [],
  metrics: {
    averageSendDuration: 0,
    providerLatency: {},
    selectorRecoveryRate: 0,
    failedSendRatio: 0,
    retryCount: 0,
    timeoutCount: 0,
    cacheHitRatio: 0,
    fallbackUsageRatio: 0,
    uploadSuccessRatio: 0,
    webviewCrashCount: 0,
    recoverySuccessRatio: 0,
    totalSends: 0,
    successfulSends: 0,
    failedSends: 0,
    executeJsErrorCount: 0,
    staleWebviewCount: 0
  },
  panelOpen: false,
  autoOpenTriggered: false,
  webviewState: {
    activeWebviewId: null,
    currentProvider: null,
    visible: true,
    ready: false,
    frozen: false,
    automationLocked: false,
    queueBlocked: false,
    activeSelectorStrategy: null,
    fallbackActive: false,
    lastExecuteJsDuration: null
  },
  lastPipelineEvents: {},

  emitEvent: (params) => {
    const state = get()
    if (!state.enabled) return

    const maxEvents =
      state.performanceMode === 'lightweight'
        ? MAX_DIAGNOSTICS_EVENTS_LIGHTWEIGHT
        : MAX_DIAGNOSTICS_EVENTS

    const event: DiagnosticsEvent = {
      id: generateEventId(),
      type: params.type,
      timestamp: Date.now(),
      provider: params.provider,
      severity: params.severity ?? 'info',
      pipelineStage: params.pipelineStage,
      duration: params.duration,
      message: params.message,
      retryCount: params.retryCount,
      timedOut: params.timedOut,
      selectorUsed: params.selectorUsed,
      selectorFallback: params.selectorFallback,
      confidenceScore: params.confidenceScore,
      fallbackStrategy: params.fallbackStrategy,
      candidateCount: params.candidateCount,
      cacheStatus: params.cacheStatus,
      source: getSourceForEvent(params.type)
    }

    const newEvents = pruneEvents([...state.events, event], maxEvents)

    let lastError = state.lastError
    let lastSuccess = state.lastSuccess
    let providerDegraded = state.providerDegraded
    let autoOpenTriggered = state.autoOpenTriggered

    if (params.severity === 'error') {
      lastError = params.message ?? null
    }

    if (
      params.type === 'SEND_SUCCESS' ||
      params.type === 'IMAGE_UPLOAD_SUCCESS' ||
      params.type === 'CLIPBOARD_SUCCESS' ||
      params.type === 'PASTE_SUCCESS'
    ) {
      lastSuccess = Date.now()
    }

    if (params.type === 'PROVIDER_DEGRADED') {
      providerDegraded = true
    }

    const providerHealth = { ...state.providerHealth }
    const currentProvider = params.provider

    if (params.severity === 'error' || params.timedOut || params.duration) {
      const signalType = params.timedOut
        ? 'timeout'
        : params.severity === 'error'
          ? 'failed_send'
          : params.duration && params.duration > 2000
            ? 'send_latency'
            : null

      if (signalType) {
        const existing = providerHealth[currentProvider]
        const health = updateProviderHealth(
          existing,
          {
            type: signalType,
            timestamp: event.timestamp,
            provider: currentProvider,
            weight: params.duration ? params.duration / 1000 : 1
          },
          newEvents
        )
        providerHealth[currentProvider] = health

        if (health.status !== 'HEALTHY') {
          providerDegraded = true
        }
      }
    }

    if (state.panelOpen) {
      const groupedErrors = groupErrors(newEvents)
      const now = Date.now()
      const metrics = computeTelemetryMetrics(
        newEvents,
        state.totalSends,
        state.averageSendTime,
        now
      )

      set({
        events: newEvents,
        lastError,
        lastSuccess,
        providerDegraded,
        providerHealth,
        groupedErrors,
        metrics,
        autoOpenTriggered
      })
    } else {
      set({
        events: newEvents,
        lastError,
        lastSuccess,
        providerDegraded,
        providerHealth,
        autoOpenTriggered
      })
    }
  },

  setEnabled: (enabled) => {
    if (!enabled) {
      resetMetricsCache()
    }
    set({ enabled })
  },

  setShowPanel: (showPanel) => set({ showPanel }),

  setVerboseLogging: (verboseLogging) => set({ verboseLogging }),

  setAutoOpenOnError: (autoOpenOnError) => set({ autoOpenOnError }),

  setProviderDegraded: (providerDegraded) => set({ providerDegraded }),

  setCurrentProvider: (currentProvider) => {
    set({ currentProvider })

    const state = get()
    if (currentProvider && !state.providerHealth[currentProvider]) {
      const health = computeProviderHealthFromEvents(currentProvider, state.events)
      set((s) => ({
        providerHealth: { ...s.providerHealth, [currentProvider]: health }
      }))
    }
  },

  setQueueSize: (queueSize) => set({ queueSize }),

  setWebviewReady: (webviewReady) => set({ webviewReady }),

  setPerformanceMode: (performanceMode) => {
    set((state) => {
      const maxEvents =
        performanceMode === 'lightweight'
          ? MAX_DIAGNOSTICS_EVENTS_LIGHTWEIGHT
          : MAX_DIAGNOSTICS_EVENTS
      return {
        performanceMode,
        events: pruneEvents(state.events, maxEvents)
      }
    })
  },

  recordSend: (duration, success) => {
    set((state) => {
      const totalSends = state.totalSends + 1
      const averageSendTime = (state.averageSendTime * (totalSends - 1) + duration) / totalSends

      return {
        totalSends,
        averageSendTime: Math.round(averageSendTime * 100) / 100,
        lastSuccess: success ? Date.now() : state.lastSuccess
      }
    })

    const state = get()
    if (state.panelOpen) {
      const metrics = computeTelemetryMetrics(
        state.events,
        state.totalSends,
        state.averageSendTime,
        Date.now(),
        true
      )
      set({ metrics })
    }
  },

  setLastError: (lastError) => set({ lastError }),

  clearEvents: () => {
    resetMetricsCache()
    set({
      events: [],
      lastError: null,
      lastSuccess: null,
      groupedErrors: [],
      providerHealth: {},
      metrics: {
        averageSendDuration: 0,
        providerLatency: {},
        selectorRecoveryRate: 0,
        failedSendRatio: 0,
        retryCount: 0,
        timeoutCount: 0,
        cacheHitRatio: 0,
        fallbackUsageRatio: 0,
        uploadSuccessRatio: 0,
        webviewCrashCount: 0,
        recoverySuccessRatio: 0,
        totalSends: 0,
        successfulSends: 0,
        failedSends: 0,
        executeJsErrorCount: 0,
        staleWebviewCount: 0
      },
      autoOpenTriggered: false
    })
  },

  reset: () => {
    resetMetricsCache()
    set({
      enabled: false,
      showPanel: true,
      verboseLogging: false,
      autoOpenOnError: false,
      events: [],
      lastError: null,
      lastSuccess: null,
      providerDegraded: false,
      currentProvider: null,
      queueSize: 0,
      webviewReady: false,
      performanceMode: 'normal',
      totalSends: 0,
      averageSendTime: 0,
      providerHealth: {},
      groupedErrors: [],
      metrics: {
        averageSendDuration: 0,
        providerLatency: {},
        selectorRecoveryRate: 0,
        failedSendRatio: 0,
        retryCount: 0,
        timeoutCount: 0,
        cacheHitRatio: 0,
        fallbackUsageRatio: 0,
        uploadSuccessRatio: 0,
        webviewCrashCount: 0,
        recoverySuccessRatio: 0,
        totalSends: 0,
        successfulSends: 0,
        failedSends: 0,
        executeJsErrorCount: 0,
        staleWebviewCount: 0
      },
      panelOpen: false,
      autoOpenTriggered: false,
      webviewState: {
        activeWebviewId: null,
        currentProvider: null,
        visible: true,
        ready: false,
        frozen: false,
        automationLocked: false,
        queueBlocked: false,
        activeSelectorStrategy: null,
        fallbackActive: false,
        lastExecuteJsDuration: null
      },
      lastPipelineEvents: {}
    })
  },

  exportSnapshot: (appVersion, platform) => {
    const state = get()
    const snapshot: DiagnosticsSnapshot = {
      appVersion,
      platform,
      timestamp: Date.now(),
      providerState: {
        currentProvider: state.currentProvider,
        providerDegraded: state.providerDegraded,
        totalSends: state.totalSends,
        averageSendTime: state.averageSendTime,
        health: state.providerHealth
      },
      queueState: {
        queueSize: state.queueSize,
        webviewReady: state.webviewReady
      },
      timingSummary: {
        lastSendTime: state.lastSuccess,
        averageSendTime: state.averageSendTime,
        totalSends: state.totalSends,
        providerLatency: state.metrics.providerLatency
      },
      metrics: state.metrics,
      lastError: state.lastError,
      groupedErrors: state.groupedErrors,
      events: state.events.slice(-MAX_DIAGNOSTICS_EVENTS),
      settings: {
        enabled: state.enabled,
        verboseLogging: state.verboseLogging,
        autoOpenOnError: state.autoOpenOnError,
        performanceMode: state.performanceMode
      },
      webviewState: state.webviewState
    }

    return createSafeExport(snapshot)
  },

  setPanelOpen: (panelOpen) => {
    if (panelOpen) {
      const state = get()
      const groupedErrors = groupErrors(state.events)
      const now = Date.now()
      const metrics = computeTelemetryMetrics(
        state.events,
        state.totalSends,
        state.averageSendTime,
        now
      )
      set({ autoOpenTriggered: false, panelOpen, groupedErrors, metrics })
    } else {
      set({ panelOpen })
    }
  },

  setAutoOpenTriggered: (autoOpenTriggered) => set({ autoOpenTriggered }),

  updateWebviewState: (partial) =>
    set((state) => ({
      webviewState: { ...state.webviewState, ...partial }
    })),

  recordHealthSignal: (signal) => {
    set((state) => {
      const existing = state.providerHealth[signal.provider]
      const health = updateProviderHealth(existing, signal, state.events)

      return {
        providerHealth: { ...state.providerHealth, [signal.provider]: health },
        providerDegraded: health.status !== 'HEALTHY' ? true : state.providerDegraded
      }
    })
  }
}))
