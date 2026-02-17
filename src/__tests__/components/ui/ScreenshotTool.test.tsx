import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ScreenshotTool from '@src/components/ui/ScreenshotTool'

// Mock Logger
vi.mock('@src/utils/logger', () => ({
    Logger: {
        error: vi.fn(),
        warn: vi.fn()
    }
}))

vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

describe('ScreenshotTool Component', () => {
    const onCapture = vi.fn()
    const onClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // Mock electronAPI
        window.electronAPI = {
            captureScreen: vi.fn().mockResolvedValue('data:image/png;base64,result'),
        } as any
    })

    it('renders nothing when not active', () => {
        const { container } = render(
            <ScreenshotTool isActive={false} onCapture={onCapture} onClose={onClose} />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('renders overlay when active', () => {
        render(
            <ScreenshotTool isActive={true} onCapture={onCapture} onClose={onClose} />
        )
        expect(screen.getByText('cancel_with_esc')).toBeInTheDocument()
    })

    it('handles selection drag and capture', async () => {
        render(
            <ScreenshotTool isActive={true} onCapture={onCapture} onClose={onClose} />
        )

        const overlay = screen.getByText('cancel_with_esc').closest('.screenshot-overlay') as Element

        // Start selection at (10, 10)
        fireEvent.mouseDown(overlay, { clientX: 10, clientY: 10, button: 0 })

        // Drag to (110, 110) -> width 100, height 100
        fireEvent.mouseMove(overlay, { clientX: 110, clientY: 110 })

        // Finish selection
        fireEvent.mouseUp(overlay)

        // The component waits for 2 animation frames. We need to wait for that.
        // Since we are not using fake timers here (mockResolvedValue is mostly instant),
        // we rely on waitFor to poll until expectation is met.

        await waitFor(() => {
            expect(window.electronAPI.captureScreen).toHaveBeenCalledWith({
                x: 10,
                y: 10,
                width: 100,
                height: 100
            })
        })

        expect(onCapture).toHaveBeenCalledWith('data:image/png;base64,result', {
            left: 10,
            top: 10,
            width: 100,
            height: 100
        })

        expect(onClose).toHaveBeenCalled()
    })

    it('cancels on Escape key', () => {
        render(
            <ScreenshotTool isActive={true} onCapture={onCapture} onClose={onClose} />
        )

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalled()
    })

    it('ignores small selection', () => {
        const { container } = render(
            <ScreenshotTool isActive={true} onCapture={onCapture} onClose={onClose} />
        )
        const overlay = container.firstChild as Element

        // Small drag (5x5)
        fireEvent.mouseDown(overlay, { clientX: 10, clientY: 10, button: 0 })
        fireEvent.mouseMove(overlay, { clientX: 15, clientY: 15 })
        fireEvent.mouseUp(overlay)

        expect(window.electronAPI.captureScreen).not.toHaveBeenCalled()
        expect(onClose).toHaveBeenCalled()
    })
})
