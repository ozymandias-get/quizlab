import { renderHook, act } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { usePdfTextSelection } from '@features/pdf/ui/hooks/usePdfTextSelection'

function createRect(): DOMRect {
    return {
        x: 120,
        y: 80,
        top: 80,
        left: 120,
        right: 260,
        bottom: 120,
        width: 140,
        height: 40,
        toJSON: () => ({})
    } as DOMRect
}

describe('usePdfTextSelection', () => {
    const onTextSelection = vi.fn()
    const originalGetSelection = window.getSelection
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame

    beforeEach(() => {
        vi.clearAllMocks()
        Object.defineProperty(window, 'requestAnimationFrame', {
            configurable: true,
            value: vi.fn((callback: FrameRequestCallback) => {
                callback(16)
                return 1
            })
        })
        Object.defineProperty(window, 'cancelAnimationFrame', {
            configurable: true,
            value: vi.fn()
        })
    })

    afterEach(() => {
        Object.defineProperty(window, 'getSelection', {
            configurable: true,
            value: originalGetSelection
        })
        Object.defineProperty(window, 'requestAnimationFrame', {
            configurable: true,
            value: originalRequestAnimationFrame
        })
        Object.defineProperty(window, 'cancelAnimationFrame', {
            configurable: true,
            value: originalCancelAnimationFrame
        })
        vi.useRealTimers()
    })

    it('reports text selected inside the PDF container', () => {
        const container = document.createElement('div')
        const textSpan = document.createElement('span')
        textSpan.textContent = 'Selected PDF text'
        container.appendChild(textSpan)
        document.body.appendChild(container)

        const range = {
            commonAncestorContainer: textSpan,
            getBoundingClientRect: () => createRect()
        }

        Object.defineProperty(window, 'getSelection', {
            configurable: true,
            value: () => ({
                isCollapsed: false,
                rangeCount: 1,
                anchorNode: textSpan.firstChild,
                focusNode: textSpan.firstChild,
                toString: () => 'Selected PDF text',
                getRangeAt: () => range
            })
        })

        renderHook(() => usePdfTextSelection({
            containerRef: { current: container },
            onTextSelection
        }))

        act(() => {
            textSpan.dispatchEvent(new Event('pointerdown', { bubbles: true }))
            document.dispatchEvent(new Event('pointerup', { bubbles: true }))
        })

        expect(onTextSelection).toHaveBeenCalledWith('Selected PDF text', { top: 26, left: 190 })
        expect(container.classList.contains('pdf-selection-active')).toBe(true)
        container.remove()
    })

    it('clears selection when the range extends outside the PDF container', () => {
        const container = document.createElement('div')
        const insideSpan = document.createElement('span')
        insideSpan.textContent = 'Inside'
        const outsideSpan = document.createElement('span')
        outsideSpan.textContent = 'Outside'
        container.appendChild(insideSpan)
        document.body.appendChild(container)
        document.body.appendChild(outsideSpan)

        const range = {
            commonAncestorContainer: document.body,
            getBoundingClientRect: () => createRect()
        }

        Object.defineProperty(window, 'getSelection', {
            configurable: true,
            value: () => ({
                isCollapsed: false,
                rangeCount: 1,
                anchorNode: insideSpan.firstChild,
                focusNode: outsideSpan.firstChild,
                toString: () => 'Inside Outside',
                getRangeAt: () => range
            })
        })

        renderHook(() => usePdfTextSelection({
            containerRef: { current: container },
            onTextSelection
        }))

        act(() => {
            insideSpan.dispatchEvent(new Event('pointerdown', { bubbles: true }))
            document.dispatchEvent(new Event('pointerup', { bubbles: true }))
        })

        expect(onTextSelection).toHaveBeenCalledWith('', null)
        outsideSpan.remove()
        container.remove()
    })

    it('accepts edge selections when the range still overlaps the PDF container', () => {
        const container = document.createElement('div')
        const insideSpan = document.createElement('span')
        insideSpan.textContent = 'Inside'
        const outsideSpan = document.createElement('span')
        outsideSpan.textContent = 'Outside'
        container.appendChild(insideSpan)
        document.body.appendChild(container)
        document.body.appendChild(outsideSpan)

        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            x: 100,
            y: 60,
            top: 60,
            left: 100,
            right: 320,
            bottom: 220,
            width: 220,
            height: 160,
            toJSON: () => ({})
        } as DOMRect)

        const range = {
            commonAncestorContainer: document.body,
            getBoundingClientRect: () => createRect()
        }

        Object.defineProperty(window, 'getSelection', {
            configurable: true,
            value: () => ({
                isCollapsed: false,
                rangeCount: 1,
                anchorNode: insideSpan.firstChild,
                focusNode: outsideSpan.firstChild,
                toString: () => 'Inside Outside',
                getRangeAt: () => range
            })
        })

        renderHook(() => usePdfTextSelection({
            containerRef: { current: container },
            onTextSelection
        }))

        act(() => {
            insideSpan.dispatchEvent(new Event('pointerdown', { bubbles: true }))
            document.dispatchEvent(new Event('pointerup', { bubbles: true }))
        })

        expect(onTextSelection).toHaveBeenCalledWith('Inside Outside', { top: 26, left: 190 })
        outsideSpan.remove()
        container.remove()
    })

    it('clears and stays idle when disabled', () => {
        const container = document.createElement('div')
        document.body.appendChild(container)

        renderHook(() => usePdfTextSelection({
            containerRef: { current: container },
            onTextSelection,
            enabled: false
        }))

        act(() => {
            document.dispatchEvent(new Event('pointerup', { bubbles: true }))
        })

        expect(onTextSelection).toHaveBeenCalledTimes(1)
        expect(onTextSelection).toHaveBeenCalledWith('', null)
        container.remove()
    })

    it('removes active selection styling when browser selection is cleared', async () => {
        const container = document.createElement('div')
        document.body.appendChild(container)
        container.classList.add('pdf-selection-active')

        Object.defineProperty(window, 'getSelection', {
            configurable: true,
            value: () => ({
                isCollapsed: true,
                rangeCount: 0,
                toString: () => ''
            })
        })

        renderHook(() => usePdfTextSelection({
            containerRef: { current: container },
            onTextSelection
        }))

        act(() => {
            document.dispatchEvent(new Event('selectionchange'))
        })

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 35))
        })

        expect(onTextSelection).toHaveBeenCalledWith('', null)
        expect(container.classList.contains('pdf-selection-active')).toBe(false)
        container.remove()
    })
})
