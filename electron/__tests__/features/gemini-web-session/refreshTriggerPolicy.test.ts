/**
 * Tests for electron/features/gemini-web-session/refreshTriggerPolicy.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../electron/features/gemini-web-session/sessionUtils', () => ({
  nowIso: vi.fn(() => '2026-04-07T19:30:00.000Z')
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionConfig', () => ({
  get FEATURE_ENABLED() {
    return true
  }
}))

const { RefreshTriggerPolicy } =
  await import('../../../../electron/features/gemini-web-session/refreshTriggerPolicy.js')

describe('RefreshTriggerPolicy', () => {
  let policy: InstanceType<typeof RefreshTriggerPolicy>

  beforeEach(() => {
    policy = new RefreshTriggerPolicy({
      metadataRepository: {} as any,
      profileLock: {} as any,
      recovery: {} as any,
      config: {} as any,
      resolvePersistentSession: (() => ({})) as any,
      emitRefreshEvent: vi.fn() as any,
      initialize: vi.fn() as any,
      getActiveCheck: vi.fn() as any,
      getAbortSignal: () => new AbortController().signal
    })
  })

  describe('triggerRefresh', () => {
    it('returns undefined', async () => {
      const result = policy.triggerRefresh({ reason: 'proactive_expiry' })
      await expect(result).resolves.toBeUndefined()
    })
  })

  describe('getActiveRefresh / clearActiveRefresh', () => {
    it('returns null when no active refresh', () => {
      expect(policy.getActiveRefresh()).toBeNull()
    })

    it('returns null after clearing', () => {
      policy.clearActiveRefresh()
      expect(policy.getActiveRefresh()).toBeNull()
    })
  })
})
