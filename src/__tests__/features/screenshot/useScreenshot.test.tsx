import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScreenshot } from '@src/features/screenshot/hooks/useScreenshot'

describe('useScreenshot Hook', () => {
    it('initializes with false state', () => {
        const { result } = renderHook(() => useScreenshot())
        expect(result.current.isScreenshotMode).toBe(false)
    })

    it('toggles screenshot mode', () => {
        const { result } = renderHook(() => useScreenshot())

        act(() => {
            result.current.startScreenshot()
        })
        expect(result.current.isScreenshotMode).toBe(true)

        act(() => {
            result.current.closeScreenshot()
        })
        expect(result.current.isScreenshotMode).toBe(false)
    })

    it('handles capture and calls callback', async () => {
        const onSendToAI = vi.fn().mockResolvedValue(true)
        const { result } = renderHook(() => useScreenshot(onSendToAI))

        act(() => {
            result.current.startScreenshot()
        })
        expect(result.current.isScreenshotMode).toBe(true)

        await act(async () => {
            await result.current.handleCapture('data:image/png;base64,...')
        })

        expect(result.current.isScreenshotMode).toBe(false)
        expect(onSendToAI).toHaveBeenCalledWith('data:image/png;base64,...')
    })
})
