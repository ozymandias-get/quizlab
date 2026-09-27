/**
 * In-memory stand-in for the main-process AI config store.
 *
 * The self-healing loop only makes sense against a store that actually
 * remembers what was written: the previous bug (a counter stuck at 1) was
 * invisible precisely because the test hand-crafted `count = 2` instead of
 * replaying a real write/read cycle. These helpers therefore drive the real
 * `getAiConfig` / `saveAiConfig` IPC surface the orchestrator uses, and every
 * test that exercises promotion threads the previous iteration's *persisted*
 * value back in as the next iteration's config.
 *
 * Merge semantics mirror `aiConfigDomain.mergeConfig` closely enough for the
 * shapes these tests use: a shallow merge of the *defined* values in the patch.
 */
import type {
  AiSelectorConfig,
  AutomationExecutionDiagnostics,
  AutomationSelectorDiagnostics
} from '@shared-core/types'

import type { AiSendDiagnostics } from '@features/ai/model/types'

export interface RepairStore {
  getAiConfig: (hostname?: string) => Promise<AiSelectorConfig | null>
  saveAiConfig: (hostname: string, config: AiSelectorConfig) => Promise<boolean>
  /** Read the raw persisted value for assertions. */
  read: (hostname: string) => AiSelectorConfig | undefined
  /** Number of successful writes, for churn assertions. */
  writeCount: () => number
  reset: () => void
}

function cloneConfig(config: AiSelectorConfig): AiSelectorConfig {
  return JSON.parse(JSON.stringify(config)) as AiSelectorConfig
}

function mergeDefined(base: AiSelectorConfig, patch: AiSelectorConfig): AiSelectorConfig {
  const next: AiSelectorConfig = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      next[key] = value
    }
  }
  return next
}

export interface CreateRepairStoreOptions {
  initial: Record<string, AiSelectorConfig>
  /**
   * Simulated main-process latency in ms. A non-zero delay makes the
   * concurrency tests genuinely interleaved instead of accidentally
   * sequential.
   */
  latencyMs?: number
  /** Force `saveAiConfig` to reject, for failure-isolation tests. */
  failSaves?: boolean
}

export function createRepairStore(options: CreateRepairStoreOptions): RepairStore {
  const { initial, latencyMs = 0, failSaves = false } = options
  const store: Record<string, AiSelectorConfig> = cloneConfig(initial) as Record<
    string,
    AiSelectorConfig
  >
  let writes = 0

  const delay = () =>
    latencyMs > 0 ? new Promise((resolve) => setTimeout(resolve, latencyMs)) : Promise.resolve()

  return {
    async getAiConfig(hostname?: string) {
      await delay()
      if (!hostname) return null
      const config = store[hostname]
      // The real handler fails with `not_found`, which surfaces as a rejection.
      if (!config) throw new Error('not_found')
      return cloneConfig(config)
    },
    async saveAiConfig(hostname: string, config: AiSelectorConfig) {
      await delay()
      if (failSaves) throw new Error('disk full')
      store[hostname] = mergeDefined(store[hostname] ?? {}, config)
      writes += 1
      return true
    },
    read: (hostname: string) => (store[hostname] ? cloneConfig(store[hostname]) : undefined),
    writeCount: () => writes,
    reset: () => {
      for (const key of Object.keys(store)) delete store[key]
      Object.assign(store, cloneConfig(initial))
      writes = 0
    }
  }
}

const BASE_LOCATOR: Omit<AutomationSelectorDiagnostics, 'requestedSelector' | 'matchedSelector'> = {
  strategy: 'candidate',
  durationMs: 1,
  waitIterations: 1,
  cacheHits: 0,
  cacheInvalidations: 0,
  interactiveRequired: false,
  recovered: true,
  confidenceScore: 95,
  confidenceLevel: 'high',
  stableSelector: 'textarea[data-testid="ask"]',
  repairEligible: true,
  repairReason: 'eligible',
  operationSucceeded: true
}

const BASE_BUTTON: Omit<AutomationSelectorDiagnostics, 'requestedSelector' | 'matchedSelector'> = {
  strategy: 'fingerprint',
  durationMs: 1,
  waitIterations: 1,
  cacheHits: 0,
  cacheInvalidations: 0,
  interactiveRequired: true,
  recovered: true,
  confidenceScore: 110,
  confidenceLevel: 'high',
  stableSelector: 'button[data-testid="send"]',
  repairEligible: true,
  repairReason: 'eligible',
  operationSucceeded: true
}

/** A healthy locator: found directly, nothing to learn. */
export function healthyInputDiagnostics(
  overrides: Partial<AutomationSelectorDiagnostics> = {}
): AutomationSelectorDiagnostics {
  return {
    requestedSelector: '#ask',
    matchedSelector: '#ask',
    ...BASE_LOCATOR,
    strategy: 'direct',
    recovered: false,
    repairEligible: false,
    repairReason: 'not_recovered',
    stableSelector: null,
    confidenceScore: undefined,
    confidenceLevel: undefined,
    operationSucceeded: undefined,
    ...overrides
  }
}

export function recoveredInputDiagnostics(
  overrides: Partial<AutomationSelectorDiagnostics> = {}
): AutomationSelectorDiagnostics {
  return {
    requestedSelector: '#gone',
    matchedSelector: 'textarea[data-testid="ask"]',
    ...BASE_LOCATOR,
    ...overrides
  }
}

export function recoveredButtonDiagnostics(
  overrides: Partial<AutomationSelectorDiagnostics> = {}
): AutomationSelectorDiagnostics {
  return {
    requestedSelector: 'button#old',
    matchedSelector: 'button[data-testid="send"]',
    ...BASE_BUTTON,
    ...overrides
  }
}

export function healthyButtonDiagnostics(
  overrides: Partial<AutomationSelectorDiagnostics> = {}
): AutomationSelectorDiagnostics {
  return {
    requestedSelector: '#send',
    matchedSelector: '#send',
    ...BASE_BUTTON,
    strategy: 'direct',
    recovered: false,
    repairEligible: false,
    repairReason: 'not_recovered',
    stableSelector: null,
    confidenceScore: undefined,
    confidenceLevel: undefined,
    operationSucceeded: undefined,
    ...overrides
  }
}

export function scriptDiagnostics(
  input: AutomationSelectorDiagnostics,
  button?: AutomationSelectorDiagnostics
): AutomationExecutionDiagnostics {
  return {
    kind: 'auto_send',
    pageUrl: 'https://example.com/chat',
    totalMs: 1,
    input,
    ...(button ? { button } : {}),
    setInputMs: 1,
    submitMs: 1,
    error: null
  }
}

export function createSendDiagnostics(
  overrides: Partial<AiSendDiagnostics> = {}
): AiSendDiagnostics {
  return {
    pipeline: 'text',
    currentAI: 'custom-ai',
    autoSend: false,
    timings: { queueWaitMs: 0, configResolveMs: 0, totalMs: 0 },
    ...overrides
  }
}
