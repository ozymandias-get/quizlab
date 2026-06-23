import type { ProbeOutcome } from '@electron/features/gemini-web-session/stateMachine'
import {
  applyProbeTransition,
  createDefaultStatus
} from '@electron/features/gemini-web-session/stateMachine'

import { describe, expect, it } from 'vitest'

describe('createDefaultStatus', () => {
  it('should create uninitialized status with feature enabled', () => {
    const status = createDefaultStatus(true)
    expect(status.state).toBe('uninitialized')
    expect(status.featureEnabled).toBe(true)
    expect(status.enabled).toBe(true)
    expect(status.consecutiveFailures).toBe(0)
    expect(status.reasonCode).toBe('none')
    expect(status.lastHealthyAt).toBeNull()
    expect(status.lastCheckAt).toBeNull()
    expect(status.enabledAppIds).toEqual([])
  })

  it('should use featureEnabled as default for enabled', () => {
    const status = createDefaultStatus(false)
    expect(status.featureEnabled).toBe(false)
    expect(status.enabled).toBe(false)
  })

  it('should allow overriding enabled independently', () => {
    const status = createDefaultStatus(true, false)
    expect(status.featureEnabled).toBe(true)
    expect(status.enabled).toBe(false)
  })
})

describe('applyProbeTransition', () => {
  const baseStatus = createDefaultStatus(true)

  it('should transition to authenticated on healthy probe', () => {
    const outcome: ProbeOutcome = { kind: 'authenticated', healthy: true }
    const result = applyProbeTransition({
      previous: baseStatus,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 2
    })
    expect(result.state).toBe('authenticated')
    expect(result.consecutiveFailures).toBe(0)
    expect(result.reasonCode).toBe('none')
    expect(result.lastHealthyAt).toBe('2025-01-15T12:00:00Z')
  })

  it('should transition to degraded on network failure', () => {
    const outcome: ProbeOutcome = { kind: 'network', healthy: false }
    const result = applyProbeTransition({
      previous: baseStatus,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 2
    })
    expect(result.state).toBe('degraded')
    expect(result.consecutiveFailures).toBe(1)
    expect(result.reasonCode).toBe('network')
  })

  it('should transition to reauth_required on challenge', () => {
    const outcome: ProbeOutcome = { kind: 'challenge', healthy: false }
    const result = applyProbeTransition({
      previous: baseStatus,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 5
    })
    expect(result.state).toBe('reauth_required')
    expect(result.reasonCode).toBe('challenge')
  })

  it('should transition to reauth_required when failures reach max', () => {
    const statusWith1Failure = { ...baseStatus, consecutiveFailures: 1 }
    const outcome: ProbeOutcome = { kind: 'login_redirect', healthy: false }
    const result = applyProbeTransition({
      previous: statusWith1Failure,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 2
    })
    expect(result.state).toBe('reauth_required')
    expect(result.consecutiveFailures).toBe(2)
  })

  it('should stay degraded when failures below max', () => {
    const outcome: ProbeOutcome = { kind: 'login_redirect', healthy: false }
    const result = applyProbeTransition({
      previous: baseStatus,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 3
    })
    expect(result.state).toBe('degraded')
    expect(result.consecutiveFailures).toBe(1)
  })

  it('should reset consecutive failures to 0 on healthy probe', () => {
    const statusWithFailures = { ...baseStatus, consecutiveFailures: 5 }
    const outcome: ProbeOutcome = { kind: 'authenticated', healthy: true }
    const result = applyProbeTransition({
      previous: statusWithFailures,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 2
    })
    expect(result.consecutiveFailures).toBe(0)
  })

  it('should set reasonCode to login_redirect for login_redirect kind', () => {
    const outcome: ProbeOutcome = { kind: 'login_redirect', healthy: false }
    const result = applyProbeTransition({
      previous: baseStatus,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 5
    })
    expect(result.reasonCode).toBe('login_redirect')
  })

  it('should set reasonCode to unknown for unknown kind', () => {
    const outcome: ProbeOutcome = { kind: 'unknown', healthy: false }
    const result = applyProbeTransition({
      previous: baseStatus,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 5
    })
    expect(result.reasonCode).toBe('unknown')
  })

  it('should always update lastCheckAt', () => {
    const outcome: ProbeOutcome = { kind: 'network', healthy: false }
    const result = applyProbeTransition({
      previous: baseStatus,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 2
    })
    expect(result.lastCheckAt).toBe('2025-01-15T12:00:00Z')
  })

  it('should preserve enabledAppIds from previous status', () => {
    const statusWithApps = { ...baseStatus, enabledAppIds: ['gemini'] as any }
    const outcome: ProbeOutcome = { kind: 'authenticated', healthy: true }
    const result = applyProbeTransition({
      previous: statusWithApps,
      outcome,
      timestamp: '2025-01-15T12:00:00Z',
      maxConsecutiveFailures: 2
    })
    expect(result.enabledAppIds).toEqual(['gemini'])
  })
})
