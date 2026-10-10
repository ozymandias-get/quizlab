/**
 * Manual re-pick vs self-healing persistence race (PHASE 1 gate).
 *
 * Scenario from the gate spec:
 *   1. An automatic repair starts working on the old selectors.
 *   2. The user picks and saves new selectors.
 *   3. The pending repair finishes.
 *   4. The user's latest manual selection must NOT be overridden.
 *
 * R1a: repair queued first, manual pick second. The pick joins the same
 * per-host queue, so it totally orders after the repair and the full manual
 * config wins — even when the repair promoted the old recovery.
 * R1b: manual pick first, repair second. The repair re-reads the picked
 * config, its compare-and-swap sees the moved primaries, and the stale
 * evidence is dropped without any write.
 */
import type { AiSelectorConfig } from '@shared-core/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { enqueueSelectorRepair } from '@features/ai'
import type { ConfigCache } from '@features/ai/lib/aiSenderSupport'
import { reportSelectorRepair } from '@features/ai/lib/selectorRepair/reportSelectorRepair'

import {
  createRepairStore,
  createSendDiagnostics,
  recoveredInputDiagnostics,
  scriptDiagnostics,
  type RepairStore
} from './repairStore.test-helpers'

const { mockGetElectronApi } = vi.hoisted(() => ({ mockGetElectronApi: vi.fn() }))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => mockGetElectronApi()
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

const OLD_INPUT = '#gone'
const REPAIR_SELECTOR = 'textarea[data-testid="ask"]'

const SEND_TIME_CONFIG: AiSelectorConfig = {
  version: 2,
  input: OLD_INPUT,
  button: 'button#old',
  inputCandidates: [OLD_INPUT, REPAIR_SELECTOR],
  inputFingerprint: { tag: 'textarea', dataTestId: 'ask' },
  health: 'ready'
}

// Staged at 2: the next observed success would promote.
const STAGED_AT_TWO: AiSelectorConfig = {
  ...SEND_TIME_CONFIG,
  repair: {
    input: {
      selector: REPAIR_SELECTOR,
      strategy: 'candidate',
      confidenceScore: 95,
      confidenceLevel: 'high',
      firstSeenAt: 1_700_000_000_000,
      lastSeenAt: 1_700_000_000_000,
      successCount: 2,
      consecutiveSuccessCount: 2,
      sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
    }
  }
}

const MANUAL_PICK: AiSelectorConfig = {
  version: 2,
  input: '#brand-new',
  button: 'button#new',
  inputCandidates: ['#brand-new'],
  buttonCandidates: ['button#new'],
  inputFingerprint: { tag: 'textarea', placeholder: 'New composer' },
  buttonFingerprint: { tag: 'button', ariaLabel: 'Send' },
  health: 'ready',
  repair: null
}

const queryClient = { invalidateQueries: vi.fn() } as unknown as Parameters<
  typeof reportSelectorRepair
>[0]['queryClient']
const configCache: ConfigCache = { key: null, cache: null }

function send(hostname: string, aiConfig: AiSelectorConfig = SEND_TIME_CONFIG) {
  return reportSelectorRepair({
    aiConfig,
    currentUrl: `https://${hostname}/chat`,
    diagnostics: createSendDiagnostics({
      script: scriptDiagnostics(recoveredInputDiagnostics())
    }),
    queryClient,
    configCache
  })
}

/** Mirrors the manual picker's persistence path (full config + repair reset). */
function manualPickSave(store: RepairStore, hostname: string) {
  return enqueueSelectorRepair(hostname, () => store.saveAiConfig(hostname, MANUAL_PICK))
}

function cloneConfig(config: AiSelectorConfig): AiSelectorConfig {
  return JSON.parse(JSON.stringify(config)) as AiSelectorConfig
}

describe('manual re-pick vs repair race', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configCache.key = null
    configCache.cache = null
  })

  it('R1a: a repair queued before the pick cannot override the manual selection', async () => {
    const store = createRepairStore({ initial: { 'example.com': STAGED_AT_TWO } })
    // Block the repair's re-read so the manual pick is guaranteed to be
    // enqueued while the repair is still in flight. The read resolves with a
    // FROZEN pre-pick snapshot: this simulates the re-read having completed
    // before the manual save, the interleaving in which a stale promotion
    // used to clobber the user's selection.
    let releaseRead!: () => void
    const readBlocker = new Promise<void>((resolve) => {
      releaseRead = resolve
    })
    const staleRead = cloneConfig(STAGED_AT_TWO)
    mockGetElectronApi.mockReturnValue({
      ...store,
      getAiConfig: vi.fn().mockImplementation(async () => {
        await readBlocker
        return cloneConfig(staleRead)
      })
    })

    // 1. The automatic repair starts on the old selectors…
    const repairPromise = send('example.com')
    // …let the queued task reach its re-read before continuing.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    // 2. …the user picks and saves new selectors…
    const pickPromise = manualPickSave(store, 'example.com')
    // 3. …the pending repair finishes (it promotes the old recovery)…
    releaseRead()
    const [repairResult] = await Promise.all([repairPromise, pickPromise])

    expect(repairResult).toBe(true)
    // 4. …but the persisted config is the user's manual selection.
    const persisted = store.read('example.com')
    expect(persisted?.input).toBe('#brand-new')
    expect(persisted?.button).toBe('button#new')
    expect(persisted?.repair ?? null).toBeNull()
  })

  it('R1b: stale repair evidence after a manual pick is dropped without a write', async () => {
    const store = createRepairStore({ initial: { 'example.com': STAGED_AT_TWO } })
    mockGetElectronApi.mockReturnValue(store)

    // The manual pick lands first.
    await manualPickSave(store, 'example.com')
    expect(store.writeCount()).toBe(1)

    // A send that started BEFORE the pick reports its (stale) evidence after.
    const result = await send('example.com')

    expect(result).toBe(false)
    // No repair write happened: the manual selection stands untouched.
    expect(store.writeCount()).toBe(1)
    const persisted = store.read('example.com')
    expect(persisted?.input).toBe('#brand-new')
    expect(persisted?.repair ?? null).toBeNull()
  })
})
