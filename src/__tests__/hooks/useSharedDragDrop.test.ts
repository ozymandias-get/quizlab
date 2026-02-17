import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useSharedDragDrop } from '@src/hooks/useSharedDragDrop'

describe('useSharedDragDrop Hook', () => {
    it('should initialize not dragging', () => {
        const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
        expect(result.current.isDragOver).toBe(false)
    })

    it('should set dragOver state on drag enter', () => {
        const { result } = renderHook(() => useSharedDragDrop(vi.fn()))

        const dragEnterEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            dataTransfer: { types: ['Files'] },
            type: 'dragenter'
        } as unknown as React.DragEvent

        act(() => {
            result.current.dragHandlers.onDragEnter(dragEnterEvent)
        })

        expect(result.current.isDragOver).toBe(true)
    })

    it('should ignore non-file drags', () => {
        const { result } = renderHook(() => useSharedDragDrop(vi.fn()))

        const dragEnterEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            dataTransfer: { types: ['text/plain'] },
        } as unknown as React.DragEvent

        act(() => {
            result.current.dragHandlers.onDragEnter(dragEnterEvent)
        })

        expect(result.current.isDragOver).toBe(false)
    })

    it('should reset state on drop', async () => {
        const onFileReceived = vi.fn()
        const { result } = renderHook(() => useSharedDragDrop(onFileReceived))

        // Set dragging first
        act(() => {
            result.current.dragHandlers.onDragEnter({
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                dataTransfer: { types: ['Files'] },
            } as any)
        })
        expect(result.current.isDragOver).toBe(true)

        // Drop
        const mockPdfFile = new File([''], 'test.pdf', { type: 'application/pdf' })
        // Add path prop for implementation requirement
        Object.defineProperty(mockPdfFile, 'path', { value: '/path/to/test.pdf' })

        const dropEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            dataTransfer: {
                files: [mockPdfFile],
                types: ['Files']
            },
        } as unknown as React.DragEvent

        await act(async () => {
            await result.current.dragHandlers.onDrop(dropEvent)
        })

        expect(result.current.isDragOver).toBe(false)
        expect(onFileReceived).toHaveBeenCalledWith(mockPdfFile)
    })

    it('should ignore drops without PDF', async () => {
        const onFileReceived = vi.fn()
        const { result } = renderHook(() => useSharedDragDrop(onFileReceived))

        const mockTxtFile = new File([''], 'test.txt', { type: 'text/plain' })

        const dropEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            dataTransfer: { files: [mockTxtFile] },
        } as unknown as React.DragEvent

        await act(async () => {
            await result.current.dragHandlers.onDrop(dropEvent)
        })

        expect(onFileReceived).not.toHaveBeenCalled()
    })
})
