/**
 * Tests for electron/features/gemini-web-session/metadataUpdatePolicy.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  return {
    nowIso: vi.fn(() => '2026-04-07T19:30:00.000Z'),
    toStrictBoolean: vi.fn((v: unknown) => v === true || v === 'true'),
    sanitizeEnabledAppIds: vi.fn((ids: string[]) => ids),
    logSuppressedError: vi.fn(),
    readMetadata: vi.fn().mockResolvedValue({
      enabled: true,
      state: 'auth_required',
      consecutiveFailures: 0,
      lastHealthyAt: null,
      enabledAppIds: ['gemini'],
      accountHash: 'hash-1'
    }),
    writeStatus: vi.fn(async (status: any, accountHash?: string) => ({
      ...status,
      accountHash: accountHash || 'hash-1'
    })),
    initialize: vi.fn().mockResolvedValue(undefined),
    monitor: { stop: vi.fn() },
    scheduleMonitor: vi.fn(),
    performHealthCheck: vi.fn().mockResolvedValue({ state: 'authenticated' })
  }
})

vi.mock('../../../../electron/core/ipcPayloadGuards', () => ({
  toStrictBoolean: mocked.toStrictBoolean
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionUtils', () => ({
  nowIso: mocked.nowIso
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionConfig', () => ({
  FEATURE_ENABLED: true
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionErrors', () => ({
  logSuppressedError: mocked.logSuppressedError
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionMetadataRepository', () => ({
  sanitizeEnabledAppIds: mocked.sanitizeEnabledAppIds
}))

const { MetadataUpdatePolicy } =
  await import('../../../../electron/features/gemini-web-session/metadataUpdatePolicy.js')

describe('MetadataUpdatePolicy', () => {
  let policy: InstanceType<typeof MetadataUpdatePolicy>
  let context: any

  beforeEach(() => {
    vi.clearAllMocks()

    context = {
      initialize: mocked.initialize,
      metadataRepository: {
        readMetadata: mocked.readMetadata,
        writeStatus: mocked.writeStatus
      },
      monitor: mocked.monitor,
      scheduleMonitor: mocked.scheduleMonitor,
      performHealthCheck: mocked.performHealthCheck
    }

    policy = new MetadataUpdatePolicy(context as any)
  })

  describe('setEnabled', () => {
    it('initialises and reads metadata before deciding what to write', async () => {
      await policy.setEnabled(true)
      expect(mocked.initialize).toHaveBeenCalled()
      expect(mocked.readMetadata).toHaveBeenCalled()
    })

    it('writes enabled=true and schedules monitor + health check', async () => {
      await policy.setEnabled(true)
      expect(mocked.writeStatus).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
        'hash-1'
      )
      expect(mocked.scheduleMonitor).toHaveBeenCalled()
      expect(mocked.performHealthCheck).toHaveBeenCalledWith()
    })

    it('writes enabled=false and stops monitor', async () => {
      await policy.setEnabled(false)
      expect(mocked.writeStatus).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
        'hash-1'
      )
      expect(mocked.monitor.stop).toHaveBeenCalled()
      expect(mocked.scheduleMonitor).not.toHaveBeenCalled()
    })

    it('returns success with status', async () => {
      const result = await policy.setEnabled(true)
      expect(result.success).toBe(true)
      expect(result.status).toBeDefined()
    })
  })

  describe('setEnabledApps', () => {
    // setEnabledApps shares the initialise + read + success-result preamble with
    // setEnabled; those two assertions now live only in the setEnabled block.

    it('writes sanitized enabledAppIds', async () => {
      await policy.setEnabledApps(['gemini', 'aistudio'])
      expect(mocked.sanitizeEnabledAppIds).toHaveBeenCalledWith(['gemini', 'aistudio'])
      expect(mocked.writeStatus).toHaveBeenCalledWith(
        expect.objectContaining({ enabledAppIds: ['gemini', 'aistudio'] }),
        'hash-1'
      )
    })

    it('returns success with status', async () => {
      const result = await policy.setEnabledApps(['gemini'])
      expect(result.success).toBe(true)
      expect(result.status).toBeDefined()
    })
  })
})
