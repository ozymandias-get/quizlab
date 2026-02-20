import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useQuizKeyboard } from '@features/quiz/hooks/useQuizKeyboard'

describe('useQuizKeyboard', () => {
    const navigateMock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    const fireKey = (key: string, options: any = {}) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
        window.dispatchEvent(event)
        return event
    }

    it('navigates next on ArrowRight', () => {
        renderHook(() => useQuizKeyboard(navigateMock, false, false))

        fireKey('ArrowRight')
        expect(navigateMock).toHaveBeenCalledWith(1)
    })

    it('navigates prev on ArrowLeft', () => {
        renderHook(() => useQuizKeyboard(navigateMock, false, false))

        fireKey('ArrowLeft')
        expect(navigateMock).toHaveBeenCalledWith(-1)
    })

    it('does not navigate next if isLast is true', () => {
        renderHook(() => useQuizKeyboard(navigateMock, false, true))

        fireKey('ArrowRight')
        expect(navigateMock).not.toHaveBeenCalled()
    })

    it('does not navigate prev if isFirst is true', () => {
        renderHook(() => useQuizKeyboard(navigateMock, true, false))

        fireKey('ArrowLeft')
        expect(navigateMock).not.toHaveBeenCalled()
    })

    it('does not navigate if typing in input', () => {
        renderHook(() => useQuizKeyboard(navigateMock, false, false))

        const input = document.createElement('input')
        document.body.appendChild(input)
        input.focus()

        fireKey('ArrowRight')
        expect(navigateMock).not.toHaveBeenCalled()

        document.body.removeChild(input)
    })

    it('ignores if modifier keys are pressed', () => {
        renderHook(() => useQuizKeyboard(navigateMock, false, false))

        fireKey('ArrowRight', { ctrlKey: true })
        expect(navigateMock).not.toHaveBeenCalled()

        fireKey('ArrowRight', { altKey: true })
        expect(navigateMock).not.toHaveBeenCalled()
    })
})
