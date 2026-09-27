/**
 * Concurrency and isolation of the repair queue.
 *
 * The send pipelines call the orchestrator fire-and-forget, so two sends can
 * finish close together. Without serialization *and* a fresh read of the
 * persisted config, both would observe the same counter and both would write
 * "2" — a lost update that silently keeps the streak from ever reaching the
 * promotion threshold.
 *
 * These tests use real async interleaving (a simulated main-process latency) and
 * the public `reportSelectorRepair` entry point, never the queue helper's
 * internals.
 */
import type { AiSelectorConfig } from '@shared-core/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConfigCache } from '@features/ai/lib/aiSenderSupport'
import { reportSelectorRepair } from '@features/ai/lib/selectorRepair/reportSelectorRepair'
import { getSelectorRepairQueueSize } from '@features/ai/lib/selectorRepair/repairQueue'

import {
  createRepairStore,
  createSendDiagnostics,
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
  inputFingerprint: { tag: 'textarea', dataTestId: 'ask' },
  health: 'ready'
}

const STAGED_AT_ONE: AiSelectorConfig = {
  ...STALE_CONFIG,
  repair: {
    input: {
      selector: 'textarea[data-testid="ask"]',
      strategy: 'candidate',
      confidenceScore: 95,
      confidenceLevel: 'high',
      firstSeenAt: 1_700_000_000_000,
      lastSeenAt: 1_700_000_000_000,
      successCount: 1,
      consecutiveSuccessCount: 1,
      sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
    }
  }
}

const queryClient = { invalidateQueries: vi.fn() } as unknown as Parameters<
  typeof reportSelectorRepair
>[0]['queryClient']
const configCache: ConfigCache = { key: null, cache: null }

function send(hostname: string, aiConfig: AiSelectorConfig = STALE_CONFIG) {
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

describe('selector repair concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configCache.key = null
    configCache.cache = null
  })

  it('D: two concurrent sends on one host do not lose an update', async () => {
    const store = createRepairStore({
      initial: { 'example.com': STAGED_AT_ONE },
      latencyMs: 5
    })
    mockGetElectronApi.mockReturnValue(store)

    // Both sends captured the same stale snapshot at pipeline start.
    const results = await Promise.all([send('example.com'), send('example.com')])

    expect(results.every(Boolean)).toBe(true)
    // 1 → 2 → 3 → promote. A lost update would leave the counter at 2.
    const persisted = store.read('example.com')
    expect(persisted?.input).toBe('textarea[data-testid="ask"]')
    expect(persisted?.health).toBe('repaired')
    expect(persisted?.repair?.input ?? null).toBeNull()
    expect(persisted?.lastRepair?.inputSelector).toBe('textarea[data-testid="ask"]')
  })

  it('D2: four concurrent sends still promote exactly once', async () => {
    const store = createRepairStore({ initial: { 'example.com': STALE_CONFIG }, latencyMs: 3 })
    mockGetElectronApi.mockReturnValue(store)

    await Promise.all([
      send('example.com'),
      send('example.com'),
      send('example.com'),
      send('example.com')
    ])

    const persisted = store.read('example.com')
    expect(persisted?.input).toBe('textarea[data-testid="ask"]')
    expect(persisted?.inputCandidates?.[0]).toBe('textarea[data-testid="ask"]')
    // No duplicate entries in the fallback list.
    expect(new Set(persisted?.inputCandidates).size).toBe(persisted?.inputCandidates?.length)
  })

  it('D3: reports whether *this* send caused the write', async () => {
    const store = createRepairStore({ initial: { 'example.com': STAGED_AT_ONE }, latencyMs: 2 })
    mockGetElectronApi.mockReturnValue(store)

    // Send A sees count 1 and stages 2; send B sees count 2 and promotes.
    const [a, b] = await Promise.all([send('example.com'), send('example.com')])
    expect([a, b].filter(Boolean)).toHaveLength(2)
  })

  it('E: different hostnames do not block each other', async () => {
    const store = createRepairStore({
      initial: {
        'chatgpt.com': STAGED_AT_ONE,
        'gemini.google.com': STAGED_AT_ONE
      },
      // A latency long enough that a global queue would visibly serialize the
      // two hosts if the implementation were wrong.
      latencyMs: 20
    })
    mockGetElectronApi.mockReturnValue(store)

    const started = Date.now()
    const [chatgpt, gemini] = await Promise.all([send('chatgpt.com'), send('gemini.google.com')])
    const elapsed = Date.now() - started

    // Each host advances its own streak independently (1 → 2).
    expect(chatgpt).toBe(true)
    expect(gemini).toBe(true)
    expect(store.read('chatgpt.com')?.repair?.input?.consecutiveSuccessCount).toBe(2)
    expect(store.read('gemini.google.com')?.repair?.input?.consecutiveSuccessCount).toBe(2)
    expect(store.read('chatgpt.com')?.input).toBe('#gone')
    expect(store.read('gemini.google.com')?.input).toBe('#gone')
    // Serialized globally this would need 2 x 3 sequential store round trips
    // (get + save per host) at 20ms each.
    expect(elapsed).toBeLessThan(20 * 6)
  })

  it('F: a failing persistence does not poison the queue', async () => {
    const store = createRepairStore({ initial: { 'example.com': STAGED_AT_ONE }, latencyMs: 1 })
    mockGetElectronApi.mockReturnValue(store)
    // First write fails, then the store recovers.
    const failing = {
      ...store,
      saveAiConfig: vi
        .fn()
        .mockRejectedValueOnce(new Error('disk full'))
        .mockImplementation(store.saveAiConfig)
    }
    mockGetElectronApi.mockReturnValue(failing)

    const failed = await send('example.com')
    expect(failed).toBe(false)
    // The failed write must not have moved the counter on disk.
    expect(store.read('example.com')?.repair?.input?.consecutiveSuccessCount).toBe(1)

    // The next send must still run and still advance the streak.
    mockGetElectronApi.mockReturnValue(store)
    const recovered = await send('example.com')
    expect(recovered).toBe(true)
    expect(store.read('example.com')?.repair?.input?.consecutiveSuccessCount).toBe(2)
  })

  it('F2: a rejection never escapes into the send pipeline', async () => {
    const store = createRepairStore({ initial: { 'example.com': STAGED_AT_ONE } })
    mockGetElectronApi.mockReturnValue({
      ...store,
      getAiConfig: vi.fn().mockRejectedValue(new Error('ipc down')),
      saveAiConfig: vi.fn().mockRejectedValue(new Error('ipc down'))
    })

    await expect(send('example.com')).resolves.toBe(false)
  })

  it('releases the queue entry once a repair settles', async () => {
    const store = createRepairStore({ initial: { 'example.com': STALE_CONFIG }, latencyMs: 1 })
    mockGetElectronApi.mockReturnValue(store)

    expect(getSelectorRepairQueueSize()).toBe(0)
    await send('example.com')
    await Promise.resolve()
    // The cleanup runs on a microtask after the tail settles.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getSelectorRepairQueueSize()).toBe(0)
  })

  it('releases the queue entry even when the repair fails', async () => {
    const store = createRepairStore({ initial: { 'example.com': STALE_CONFIG } })
    mockGetElectronApi.mockReturnValue({
      ...store,
      saveAiConfig: vi.fn().mockRejectedValue(new Error('nope'))
    })

    await send('example.com')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getSelectorRepairQueueSize()).toBe(0)
  })

  it('does not grow the queue when many hosts are repaired in sequence', async () => {
    const initial: Record<string, AiSelectorConfig> = {}
    for (let i = 0; i < 25; i++) {
      initial[`host${i}.com`] = STALE_CONFIG
    }
    const store = createRepairStore({ initial })
    mockGetElectronApi.mockReturnValue(store)

    for (let i = 0; i < 25; i++) {
      await send(`host${i}.com`)
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getSelectorRepairQueueSize()).toBe(0)
  })

  it('D4: keeps the runtime cache in sync with every persisted step', async () => {
    const store = createRepairStore({ initial: { 'example.com': STAGED_AT_ONE }, latencyMs: 1 })
    mockGetElectronApi.mockReturnValue(store)
    configCache.key = 'https://example.com/chat::custom-ai::{}'
    configCache.cache = { config: { input: '#gone' } as AiSelectorConfig, regex: null }

    await send('example.com')

    // Disk moved, so the memoized runtime config must have been dropped or the
    // next send would keep injecting the stale selector.
    expect(store.read('example.com')?.repair?.input?.consecutiveSuccessCount).toBe(2)
    expect(configCache.key).toBeNull()
    expect(configCache.cache).toBeNull()
  })
})
