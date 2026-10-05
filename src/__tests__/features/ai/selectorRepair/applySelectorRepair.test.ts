/**
 * Repair persistence path.
 *
 * The whole point of promoting a repair is that it survives a reload, so these
 * tests assert the three things that could silently break that: the patch has to
 * reach the existing config domain, the React Query cache has to be invalidated,
 * and the memoized per-content runtime config has to be dropped — otherwise the
 * next send keeps injecting the pre-repair selectors and the feature looks inert
 * until the app is restarted.
 */
import type { AiSelectorConfig } from '@shared-core/types'
import { SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD } from '@shared-core/selectorRepair'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetElectronApi, mockSaveAiConfig } = vi.hoisted(() => ({
  mockGetElectronApi: vi.fn(),
  mockSaveAiConfig: vi.fn()
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => mockGetElectronApi()
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

import { applySelectorRepair } from '@features/ai/lib/selectorRepair/applySelectorRepair'
import { reportSelectorRepair } from '@features/ai/lib/selectorRepair/reportSelectorRepair'
import type { ConfigCache } from '@features/ai/lib/aiSenderSupport'
import type { AiSendDiagnostics } from '@features/ai/model/types'

function createQueryClient() {
  return {
    invalidateQueries: vi.fn()
  } as unknown as Parameters<typeof applySelectorRepair>[0]['queryClient']
}

function createConfigCache(): ConfigCache {
  return {
    key: 'https://example.com/::custom-ai::{}',
    cache: { config: { input: '#old' } as AiSelectorConfig, regex: null }
  }
}

const PATCH: AiSelectorConfig = {
  input: 'textarea[data-testid="ask"]',
  inputCandidates: ['textarea[data-testid="ask"]', '#gone'],
  health: 'repaired'
}

describe('applySelectorRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveAiConfig.mockResolvedValue(true)
    mockGetElectronApi.mockReturnValue({ saveAiConfig: mockSaveAiConfig })
  })

  it('persists the patch through the existing config domain', async () => {
    const queryClient = createQueryClient()
    const configCache = createConfigCache()

    const saved = await applySelectorRepair({
      hostname: 'example.com',
      patch: PATCH,
      queryClient,
      configCache
    })

    expect(saved).toBe(true)
    expect(mockSaveAiConfig).toHaveBeenCalledWith('example.com', PATCH)
  })

  it('invalidates both the per-host and the global config queries', async () => {
    const queryClient = createQueryClient()

    await applySelectorRepair({
      hostname: 'example.com',
      patch: PATCH,
      queryClient,
      configCache: createConfigCache()
    })

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai', 'config', 'example.com']
    })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['ai', 'config'] })
  })

  it('drops the memoized runtime config so the promotion takes effect at once', async () => {
    const configCache = createConfigCache()
    expect(configCache.key).not.toBeNull()

    await applySelectorRepair({
      hostname: 'example.com',
      patch: PATCH,
      queryClient: createQueryClient(),
      configCache
    })

    expect(configCache.key).toBeNull()
    expect(configCache.cache).toBeNull()
  })

  it('reports failure without throwing when the electron API is unavailable', async () => {
    mockGetElectronApi.mockReturnValue(null)

    await expect(
      applySelectorRepair({
        hostname: 'example.com',
        patch: PATCH,
        queryClient: createQueryClient(),
        configCache: createConfigCache()
      })
    ).resolves.toBe(false)
  })

  it('reports failure without throwing when the save is rejected', async () => {
    mockSaveAiConfig.mockResolvedValue(false)

    await expect(
      applySelectorRepair({
        hostname: 'example.com',
        patch: PATCH,
        queryClient: createQueryClient(),
        configCache: createConfigCache()
      })
    ).resolves.toBe(false)
  })

  it('reports failure without throwing when the save rejects', async () => {
    mockSaveAiConfig.mockRejectedValue(new Error('ipc down'))

    await expect(
      applySelectorRepair({
        hostname: 'example.com',
        patch: PATCH,
        queryClient: createQueryClient(),
        configCache: createConfigCache()
      })
    ).resolves.toBe(false)
  })
})

describe('reportSelectorRepair', () => {
  const NOW = 1_700_000_000_000

  const config: AiSelectorConfig = {
    version: 2,
    input: '#gone',
    button: 'button#old',
    inputCandidates: ['#gone', 'textarea[data-testid="ask"]'],
    inputFingerprint: { tag: 'textarea', dataTestId: 'ask' },
    health: 'ready',
    repair: {
      input: {
        selector: 'textarea[data-testid="ask"]',
        strategy: 'candidate',
        confidenceScore: 95,
        confidenceLevel: 'high',
        firstSeenAt: NOW,
        lastSeenAt: NOW,
        successCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD - 1,
        consecutiveSuccessCount: SELF_HEAL_PROMOTION_SUCCESS_THRESHOLD - 1,
        sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
      }
    }
  }

  function sendDiagnostics(): AiSendDiagnostics {
    return {
      pipeline: 'text',
      currentAI: 'custom-ai',
      autoSend: false,
      timings: { queueWaitMs: 0, configResolveMs: 0, totalMs: 0 },
      script: {
        kind: 'auto_send',
        pageUrl: 'https://example.com/',
        totalMs: 1,
        input: {
          requestedSelector: '#gone',
          matchedSelector: 'textarea[data-testid="ask"]',
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
        },
        setInputMs: 1,
        submitMs: 0,
        error: null
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mockSaveAiConfig.mockResolvedValue(true)
    mockGetElectronApi.mockReturnValue({ saveAiConfig: mockSaveAiConfig })
  })

  it('promotes and persists once the threshold is reached', async () => {
    const configCache = createConfigCache()
    const queryClient = createQueryClient()

    const persisted = await reportSelectorRepair({
      aiConfig: config,
      currentUrl: 'https://example.com/chat',
      diagnostics: sendDiagnostics(),
      queryClient,
      configCache
    })

    expect(persisted).toBe(true)
    expect(mockSaveAiConfig).toHaveBeenCalledTimes(1)
    const [, patch] = mockSaveAiConfig.mock.calls[0] as [string, AiSelectorConfig]
    expect(patch.input).toBe('textarea[data-testid="ask"]')
    expect(patch.health).toBe('repaired')
    expect(patch.inputCandidates).toEqual(['textarea[data-testid="ask"]', '#gone'])
    expect(configCache.key).toBeNull()
  })

  it('writes nothing when the saved selector still works', async () => {
    const diagnostics = sendDiagnostics()
    if (diagnostics.script) {
      diagnostics.script.input.strategy = 'direct'
      diagnostics.script.input.recovered = false
      diagnostics.script.input.repairEligible = false
      diagnostics.script.input.repairReason = 'not_recovered'
    }

    const persisted = await reportSelectorRepair({
      aiConfig: config,
      currentUrl: 'https://example.com/chat',
      diagnostics,
      queryClient: createQueryClient(),
      configCache: createConfigCache()
    })

    expect(persisted).toBe(false)
    expect(mockSaveAiConfig).not.toHaveBeenCalled()
  })

  it('ignores a focus-only run because it never used the element', async () => {
    const diagnostics = sendDiagnostics()
    delete diagnostics.script
    diagnostics.focusScript = {
      kind: 'focus',
      pageUrl: 'https://example.com/chat',
      totalMs: 1,
      input: {
        requestedSelector: '#gone',
        matchedSelector: 'textarea[data-testid="ask"]',
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
        repairReason: 'eligible'
      },
      setInputMs: 0,
      submitMs: 0,
      error: null
    }

    const persisted = await reportSelectorRepair({
      aiConfig: config,
      currentUrl: 'https://example.com/chat',
      diagnostics,
      queryClient: createQueryClient(),
      configCache: createConfigCache()
    })

    expect(persisted).toBe(false)
    expect(mockSaveAiConfig).not.toHaveBeenCalled()
  })

  it('stays silent for a malformed URL', async () => {
    const persisted = await reportSelectorRepair({
      aiConfig: config,
      currentUrl: 'not-a-url',
      diagnostics: sendDiagnostics(),
      queryClient: createQueryClient(),
      configCache: createConfigCache()
    })

    expect(persisted).toBe(false)
    expect(mockSaveAiConfig).not.toHaveBeenCalled()
  })

  it('uses the click script diagnostics for the button after an image send', async () => {
    const diagnostics: AiSendDiagnostics = {
      pipeline: 'image',
      currentAI: 'custom-ai',
      autoSend: true,
      timings: { queueWaitMs: 0, configResolveMs: 0, totalMs: 0 },
      clickScript: {
        kind: 'click_send',
        pageUrl: 'https://example.com/chat',
        totalMs: 1,
        input: {
          requestedSelector: '#gone',
          matchedSelector: 'textarea',
          strategy: 'direct',
          durationMs: 1,
          waitIterations: 1,
          cacheHits: 0,
          cacheInvalidations: 0,
          interactiveRequired: false,
          recovered: false
        },
        button: {
          requestedSelector: 'button#old',
          matchedSelector: 'button[data-testid="send"]',
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
        },
        setInputMs: 0,
        submitMs: 1,
        error: null
      }
    }

    const buttonConfig: AiSelectorConfig = {
      ...config,
      repair: {
        button: {
          selector: 'button[data-testid="send"]',
          strategy: 'fingerprint',
          confidenceScore: 110,
          confidenceLevel: 'high',
          firstSeenAt: NOW,
          lastSeenAt: NOW,
          successCount: 2,
          consecutiveSuccessCount: 2,
          sourceFingerprint: null
        }
      }
    }

    const persisted = await reportSelectorRepair({
      aiConfig: buttonConfig,
      currentUrl: 'https://example.com/chat',
      diagnostics,
      queryClient: createQueryClient(),
      configCache: createConfigCache()
    })

    expect(persisted).toBe(true)
    const [, patch] = mockSaveAiConfig.mock.calls[0] as [string, AiSelectorConfig]
    expect(patch.button).toBe('button[data-testid="send"]')
    expect(patch.buttonCandidates).toEqual(['button[data-testid="send"]', 'button#old'])
  })
})
