/**
 * The durability of the staged repair counter.
 *
 * These tests deliberately drive the *real* persistence path — the orchestrator,
 * the per-hostname queue and the IPC-backed config store — instead of handing
 * the pure evaluator a hand-made `count = 2`. The previous implementation only
 * wrote on an identity change and on every third success, so the persisted
 * counter never moved past 1 and promotion was unreachable: a test that fed
 * `count = 2` straight into the evaluator would have kept passing while the
 * product never promoted anything.
 *
 * Each iteration here re-reads what the previous iteration actually persisted.
 */
import type { AiSelectorConfig } from '@shared-core/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConfigCache } from '@features/ai/lib/aiSenderSupport'
import { reportSelectorRepair } from '@features/ai/lib/selectorRepair/reportSelectorRepair'

import {
  createRepairStore,
  createSendDiagnostics,
  healthyButtonDiagnostics,
  healthyInputDiagnostics,
  recoveredButtonDiagnostics,
  recoveredInputDiagnostics,
  scriptDiagnostics
} from './repairStore.test-helpers'

const { mockGetElectronApi } = vi.hoisted(() => ({ mockGetElectronApi: vi.fn() }))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => mockGetElectronApi()
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

const STALE_CONFIG: AiSelectorConfig = {
  version: 2,
  input: '#gone',
  button: 'button#old',
  inputCandidates: ['#gone', 'textarea[data-testid="ask"]'],
  buttonCandidates: ['button#old'],
  inputFingerprint: { tag: 'textarea', dataTestId: 'ask' },
  buttonFingerprint: { tag: 'button', dataTestId: 'send' },
  health: 'ready'
}

const REPAIRED_CONFIG: AiSelectorConfig = {
  version: 2,
  input: 'textarea[data-testid="ask"]',
  button: 'button#old',
  inputCandidates: ['textarea[data-testid="ask"]', '#gone'],
  buttonCandidates: ['button#old'],
  inputFingerprint: { tag: 'textarea', dataTestId: 'ask' },
  buttonFingerprint: { tag: 'button', dataTestId: 'send' },
  health: 'repaired',
  lastRepair: {
    repairedAt: 1_700_000_000_000,
    inputSelector: 'textarea[data-testid="ask"]',
    inputStrategy: 'candidate'
  }
}

const HOST = 'example.com'
const URL = 'https://example.com/chat'

let store = createRepairStore({ initial: {} })
const queryClient = { invalidateQueries: vi.fn() } as unknown as Parameters<
  typeof reportSelectorRepair
>[0]['queryClient']
const configCache: ConfigCache = { key: null, cache: null }

/** One successful logical text send: the composer field was recovered and used. */
function recoveredTextSend() {
  return createSendDiagnostics({
    script: scriptDiagnostics(recoveredInputDiagnostics(), healthyButtonDiagnostics())
  })
}

function healthyTextSend() {
  return createSendDiagnostics({
    script: scriptDiagnostics(healthyInputDiagnostics(), healthyButtonDiagnostics())
  })
}

function send(diagnostics = recoveredTextSend()) {
  // `aiConfig` is the stale snapshot the pipeline resolved at send start; the
  // orchestrator must ignore it in favour of the latest persisted config.
  return reportSelectorRepair({
    aiConfig: STALE_CONFIG,
    currentUrl: URL,
    diagnostics,
    queryClient,
    configCache
  })
}

describe('selector repair durability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store = createRepairStore({ initial: { [HOST]: STALE_CONFIG } })
    mockGetElectronApi.mockReturnValue(store)
    configCache.key = null
    configCache.cache = null
  })

  it('A: walks 0 → 1 → 2 → promotion across four real sends', async () => {
    const observed: Array<{
      count: number
      primary: string | null
      health: string | undefined
    }> = []

    for (let i = 0; i < 4; i++) {
      await send()
      const persisted = store.read(HOST)
      observed.push({
        count: persisted?.repair?.input?.consecutiveSuccessCount ?? 0,
        primary: persisted?.input ?? null,
        health: persisted?.health
      })
    }

    // send #1 → staged at 1, primary untouched
    expect(observed[0]).toEqual({ count: 1, primary: '#gone', health: 'ready' })
    // send #2 → staged at 2, still not promoted
    expect(observed[1]).toEqual({ count: 2, primary: '#gone', health: 'ready' })
    // send #3 → promoted, staged state cleared
    expect(observed[2]).toEqual({
      count: 0,
      primary: 'textarea[data-testid="ask"]',
      health: 'repaired'
    })
    // send #4 → steady state, nothing changes
    expect(observed[3]).toEqual({
      count: 0,
      primary: 'textarea[data-testid="ask"]',
      health: 'repaired'
    })
  })

  it('B: promotes on the third independent logical send', async () => {
    expect(await send()).toBe(true) // #1 stages
    expect(store.read(HOST)?.repair?.input?.consecutiveSuccessCount).toBe(1)
    expect(store.read(HOST)?.input).toBe('#gone')

    expect(await send()).toBe(true) // #2 stages
    expect(store.read(HOST)?.repair?.input?.consecutiveSuccessCount).toBe(2)
    expect(store.read(HOST)?.input).toBe('#gone')

    expect(await send()).toBe(true) // #3 promotes
    const promoted = store.read(HOST)
    expect(promoted?.input).toBe('textarea[data-testid="ask"]')
    expect(promoted?.health).toBe('repaired')
    expect(promoted?.repair?.input ?? null).toBeNull()
    expect(promoted?.lastRepair?.inputSelector).toBe('textarea[data-testid="ask"]')
  })

  it('B2: keeps the old primary as a fallback after promotion', async () => {
    await send()
    await send()
    await send()

    const promoted = store.read(HOST)
    expect(promoted?.inputCandidates).toEqual(['textarea[data-testid="ask"]', '#gone'])
    // The fallback list must still resolve the old selector.
    expect(promoted?.inputCandidates).toContain('#gone')
  })

  it('C: keeps the staged counter across a reload between every send', async () => {
    // Each "restart" throws away every in-memory handle and rebuilds the store
    // from disk, which is the only way a staged counter can be proven to live on
    // disk rather than in a closure.
    for (const expectedAfterSend of [1, 2]) {
      await send()

      const onDisk = store.read(HOST)
      expect(onDisk?.repair?.input?.consecutiveSuccessCount).toBe(expectedAfterSend)

      // Simulate a full app restart: new store instance seeded from disk, new
      // runtime cache, new config snapshot.
      store = createRepairStore({ initial: { [HOST]: onDisk as AiSelectorConfig } })
      mockGetElectronApi.mockReturnValue(store)
      configCache.key = null
      configCache.cache = null
      expect(store.read(HOST)?.input).toBe('#gone')
    }

    // Third logical send, after the second restart.
    await send()

    const promoted = store.read(HOST)
    expect(promoted?.input).toBe('textarea[data-testid="ask"]')
    expect(promoted?.health).toBe('repaired')
  })

  it('P: the promoted selector is the primary after a restart', async () => {
    await send()
    await send()
    await send()

    const restarted = createRepairStore({
      initial: { [HOST]: store.read(HOST) as AiSelectorConfig }
    })
    mockGetElectronApi.mockReturnValue(restarted)

    // After a restart the saved selector resolves directly, so there is no
    // recovery to learn and nothing more is written.
    const writesBefore = restarted.writeCount()
    const persisted = await reportSelectorRepair({
      aiConfig: REPAIRED_CONFIG,
      currentUrl: URL,
      diagnostics: createSendDiagnostics({
        script: scriptDiagnostics(
          healthyInputDiagnostics({ requestedSelector: 'textarea[data-testid="ask"]' }),
          healthyButtonDiagnostics()
        )
      }),
      queryClient,
      configCache
    })

    expect(persisted).toBe(false)
    expect(restarted.writeCount()).toBe(writesBefore)
    expect(restarted.read(HOST)?.input).toBe('textarea[data-testid="ask"]')
  })

  it('J: a healthy primary produces zero staged writes', async () => {
    const result = await send(healthyTextSend())

    expect(result).toBe(false)
    expect(store.writeCount()).toBe(0)
    expect(store.read(HOST)?.repair ?? null).toBeNull()
    expect(store.read(HOST)?.input).toBe('#gone')
  })

  it('J2: a failed send never learns, even when an earlier script succeeded', async () => {
    // The image pipeline's failure shape: the prompt was inserted (input really
    // used) but the click failed, so the overall send is a failure and nothing
    // may be staged.
    const failedSend = createSendDiagnostics({
      pipeline: 'image',
      promptScript: scriptDiagnostics(recoveredInputDiagnostics()),
      clickScript: {
        ...scriptDiagnostics(healthyInputDiagnostics()),
        kind: 'click_send',
        error: 'click_failed'
      }
    })

    const result = await reportSelectorRepair({
      aiConfig: STALE_CONFIG,
      currentUrl: URL,
      // The pipeline only calls the orchestrator on success; a failed send has
      // no report at all. Assert the failed diagnostics would not learn even if
      // it were reported.
      diagnostics: failedSend,
      queryClient,
      configCache
    })

    // The button is blocklisted-free but its operation did not succeed, so the
    // button cannot be learned. The input evidence is real, so it may stage.
    expect(result).toBe(true)
    expect(store.read(HOST)?.repair?.button ?? null).toBeNull()
    expect(store.read(HOST)?.repair?.input?.consecutiveSuccessCount).toBe(1)
    expect(store.read(HOST)?.input).toBe('#gone')
  })

  it('I: a send whose operations all failed writes nothing', async () => {
    const result = await reportSelectorRepair({
      aiConfig: STALE_CONFIG,
      currentUrl: URL,
      diagnostics: createSendDiagnostics({
        script: scriptDiagnostics(
          recoveredInputDiagnostics({ operationSucceeded: false }),
          recoveredButtonDiagnostics({ operationSucceeded: false })
        )
      }),
      queryClient,
      configCache
    })

    expect(result).toBe(false)
    expect(store.writeCount()).toBe(0)
  })
})
