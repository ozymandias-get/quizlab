import { describe, expect, it } from 'vitest'
import { applyProbeTransition, createDefaultStatus } from '../../../features/gemini-web-session/stateMachine'

describe('gemini web session state machine', () => {
    it('resets failures on authenticated probe', () => {
        const previous = {
            ...createDefaultStatus(true),
            state: 'degraded' as const,
            consecutiveFailures: 2,
            reasonCode: 'login_redirect' as const
        }

        const next = applyProbeTransition({
            previous,
            outcome: { kind: 'authenticated', healthy: true },
            timestamp: '2026-03-02T10:00:00.000Z',
            maxConsecutiveFailures: 2
        })

        expect(next.state).toBe('authenticated')
        expect(next.consecutiveFailures).toBe(0)
        expect(next.reasonCode).toBe('none')
        expect(next.lastHealthyAt).toBe('2026-03-02T10:00:00.000Z')
    })

    it('escalates login redirect failures to reauth on max threshold', () => {
        const first = applyProbeTransition({
            previous: createDefaultStatus(true),
            outcome: { kind: 'login_redirect', healthy: false },
            timestamp: '2026-03-02T10:00:00.000Z',
            maxConsecutiveFailures: 2
        })

        const second = applyProbeTransition({
            previous: first,
            outcome: { kind: 'login_redirect', healthy: false },
            timestamp: '2026-03-02T10:01:00.000Z',
            maxConsecutiveFailures: 2
        })

        expect(first.state).toBe('degraded')
        expect(second.state).toBe('reauth_required')
        expect(second.reasonCode).toBe('login_redirect')
    })

    it('keeps network failures in degraded state', () => {
        const first = applyProbeTransition({
            previous: createDefaultStatus(true),
            outcome: { kind: 'network', healthy: false },
            timestamp: '2026-03-02T10:00:00.000Z',
            maxConsecutiveFailures: 2
        })

        const second = applyProbeTransition({
            previous: first,
            outcome: { kind: 'network', healthy: false },
            timestamp: '2026-03-02T10:01:00.000Z',
            maxConsecutiveFailures: 2
        })

        expect(first.state).toBe('degraded')
        expect(second.state).toBe('degraded')
        expect(second.reasonCode).toBe('network')
    })

    it('forces immediate reauth on challenge', () => {
        const next = applyProbeTransition({
            previous: createDefaultStatus(true),
            outcome: { kind: 'challenge', healthy: false },
            timestamp: '2026-03-02T10:00:00.000Z',
            maxConsecutiveFailures: 2
        })

        expect(next.state).toBe('reauth_required')
        expect(next.reasonCode).toBe('challenge')
    })
})
