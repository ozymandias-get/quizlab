import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLocalStorage, useLocalStorageString, useLocalStorageBoolean } from '@src/hooks/useLocalStorage'

describe('useLocalStorage Hooks', () => {

    beforeEach(() => {
        window.localStorage.clear()
        vi.clearAllMocks()
    })

    describe('useLocalStorage', () => {
        it('should return initial value when storage is empty', () => {
            const { result } = renderHook(() => useLocalStorage('test-key', { foo: 'bar' }))
            expect(result.current[0]).toEqual({ foo: 'bar' })
        })

        it('should return stored value if exists', () => {
            window.localStorage.setItem('test-key', JSON.stringify({ foo: 'baz' }))
            const { result } = renderHook(() => useLocalStorage('test-key', { foo: 'bar' }))
            expect(result.current[0]).toEqual({ foo: 'baz' })
        })

        it('should update local storage when state changes', () => {
            const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))

            act(() => {
                result.current[1]('updated')
            })

            expect(result.current[0]).toBe('updated')
            expect(window.localStorage.getItem('test-key')).toBe(JSON.stringify('updated'))
        })

        it('should handle function updates safely', () => {
            const { result } = renderHook(() => useLocalStorage<number>('count', 0))

            act(() => {
                result.current[1](prev => prev + 1)
            })

            expect(result.current[0]).toBe(1)
            expect(window.localStorage.getItem('count')).toBe('1')
        })

        it('should sync across hooks in the same window', () => {
            const { result: result1 } = renderHook(() => useLocalStorage('shared-key', 'initial'))
            const { result: result2 } = renderHook(() => useLocalStorage('shared-key', 'initial'))

            act(() => {
                result1.current[1]('updated')
            })

            expect(result2.current[0]).toBe('updated')
        })
    })

    describe('useLocalStorageString', () => {
        it('should handle raw string values without JSON quotes', () => {
            window.localStorage.setItem('str-key', 'hello world')
            const { result } = renderHook(() => useLocalStorageString('str-key', 'default'))
            expect(result.current[0]).toBe('hello world')
        })

        it('should enforce valid values if provided', () => {
            const validOptions = ['dark', 'light']
            const { result } = renderHook(() => useLocalStorageString('theme', 'light', validOptions))

            act(() => {
                result.current[1]('blue') // Invalid
            })
            // Should ignore invalid update or keep previous/default? 
            // The implementation logs a warning and didn't update storage in the hook logic.
            // Let's verify it didn't change the state effectively if the implementation blocks it.

            // Re-reading implementation: if (validValues && !validValues.includes(value)) return
            // So state shouldn't change.
            expect(result.current[0]).toBe('light')
        })
    })

    describe('useLocalStorageBoolean', () => {
        it('should parse "true" string as boolean true', () => {
            window.localStorage.setItem('bool-key', 'true')
            const { result } = renderHook(() => useLocalStorageBoolean('bool-key', false))
            expect(result.current[0]).toBe(true)
        })

        it('should toggle value', () => {
            const { result } = renderHook(() => useLocalStorageBoolean('toggle-key', false))

            act(() => {
                result.current[2]() // toggle function
            })

            expect(result.current[0]).toBe(true)
            expect(window.localStorage.getItem('toggle-key')).toBe('true')
        })
    })
})
