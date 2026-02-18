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

// Mock useCaptureScreen hook
const mockCaptureScreenMutate = vi.fn()
vi.mock('@platform/electron/api/useSystemApi', () => ({
    useCaptureScreen: () => ({
        mutateAsync: mockCaptureScreenMutate
    })
}))

describe('ScreenshotTool Component', () => {
    const onCapture = vi.fn()
    const onClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockCaptureScreenMutate.mockResolvedValue('data:image/png;base64,result')
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
        // Check for some element present when active.
        // Look at the code, when active and not selecting, it shows 'cancel_with_esc'
        expect(screen.getByText('cancel_with_esc')).toBeInTheDocument()
    })

    it('handles selection drag and capture', async () => {
        const { container } = render(
            <ScreenshotTool isActive={true} onCapture={onCapture} onClose={onClose} />
        )

        // The overlay is the main div.
        // It has check !isActive return null.
        // Then returns a div with ref={overlayRef} className="screenshot-overlay"
        const overlay = container.firstChild as Element

        // Start selection at (10, 10)
        fireEvent.mouseDown(overlay, { clientX: 10, clientY: 10, button: 0 })

        // Drag to (110, 110) -> width 100, height 100
        fireEvent.mouseMove(overlay, { clientX: 110, clientY: 110 })

        // Finish selection
        fireEvent.mouseUp(overlay)

        await waitFor(() => {
            expect(mockCaptureScreenMutate).toHaveBeenCalledWith({
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

        expect(mockCaptureScreenMutate).not.toHaveBeenCalled()
        expect(onClose).toHaveBeenCalled()
    })
})

