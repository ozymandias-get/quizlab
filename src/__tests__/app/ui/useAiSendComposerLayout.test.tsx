import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useAiSendComposerLayout } from '@app/ui/aiSendComposer/useAiSendComposerLayout'

vi.mock('@shared/hooks', async () => {
    const React = await import('react')

    return {
        useLocalStorage: <T,>(_key: string, initialValue: T) => React.useState(initialValue)
    }
})

describe('useAiSendComposerLayout', () => {
    it('does not mutate body userSelect while dragging the composer', () => {
        document.body.style.userSelect = 'text'

        const { result } = renderHook(() => useAiSendComposerLayout(1))
        const setPointerCapture = vi.fn()
        const releasePointerCapture = vi.fn()

        act(() => {
            result.current.handleDragStart({
                pointerId: 7,
                clientX: 240,
                clientY: 180,
                preventDefault: vi.fn(),
                target: document.createElement('div'),
                currentTarget: {
                    setPointerCapture
                }
            } as unknown as ReactPointerEvent<HTMLDivElement>)
        })

        expect(document.body.style.userSelect).toBe('text')
        expect(setPointerCapture).toHaveBeenCalledWith(7)

        act(() => {
            result.current.handleDragEnd({
                pointerId: 7,
                currentTarget: {
                    releasePointerCapture
                }
            } as unknown as ReactPointerEvent<HTMLDivElement>)
        })

        expect(document.body.style.userSelect).toBe('text')
        expect(releasePointerCapture).toHaveBeenCalledWith(7)
    })
})
