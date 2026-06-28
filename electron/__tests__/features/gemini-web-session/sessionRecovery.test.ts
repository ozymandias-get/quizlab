import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionRecovery } from '../../../features/gemini-web-session/sessionRecovery.js'

vi.mock('../../../features/gemini-web-session/sessionCookies', () => ({
  importExternalCookies: vi.fn()
}))

describe('session recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('runAutoProfileRecovery succeeds', async () => {
    const recovery = new SessionRecovery({
      resolvePersistentSession: () => ({}) as never
    })

    const result = await recovery.runAutoProfileRecovery()

    expect(result.success).toBe(true)
  })

  it('resetCooldowns resets silent refresh cooldown', () => {
    const recovery = new SessionRecovery({
      resolvePersistentSession: () => ({}) as never
    })

    expect(() => recovery.resetCooldowns()).not.toThrow()
  })
})
