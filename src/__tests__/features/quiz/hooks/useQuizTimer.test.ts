import { act, renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useQuizTimer } from '../../../../features/quiz/hooks/useQuizTimer'

describe('useQuizTimer', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns 00:00 initially or when startTime is null', () => {
        const { result } = renderHook(() => useQuizTimer(null))
        expect(result.current).toBe('00:00')
    })

    it('updates timer as time progresses', () => {
        const startTime = Date.now()
        const { result } = renderHook(() => useQuizTimer(startTime))

        expect(result.current).toBe('00:00')

        act(() => {
            vi.advanceTimersByTime(1000)
        })

        // 1 second elapsed
        expect(result.current).toBe('00:01')

        act(() => {
            vi.advanceTimersByTime(59000)
        })

        // 60 seconds elapsed -> 01:00
        expect(result.current).toBe('01:00')
    })

    it('handles drift gracefully (no negative time)', () => {
        const futureTime = Date.now() + 5000 // 5 seconds in future (e.g. clock drift)
        const { result } = renderHook(() => useQuizTimer(futureTime))

        expect(result.current).toBe('00:00')
    })
})
