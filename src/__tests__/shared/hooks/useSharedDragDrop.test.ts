/**
 * Tests for useSharedDragDrop — handles external PDF file drop.
 * Critical for the "drop a PDF into the window to open it" flow.
 */
import { useSharedDragDrop } from '@shared/hooks/useSharedDragDrop'

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/logger', () => ({
  Logger: {
    warn: vi.fn(),
    error: vi.fn()
  }
}))

function makeDragEvent(overrides: Partial<any> = {}): any {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      types: [] as string[],
      files: [] as File[],
      dropEffect: ''
    },
    ...overrides
  }
}

function makeFile(name: string, path?: string): File {
  const file = new File(['content'], name, { type: 'application/pdf' })
  ;(file as any).path = path
  return file
}

describe('useSharedDragDrop', () => {
  it('starts with isDragOver=false', () => {
    const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
    expect(result.current.isDragOver).toBe(false)
  })

  describe('onDragEnter', () => {
    it('sets isDragOver=true when files are being dragged', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      act(() => {
        result.current.dragHandlers.onDragEnter(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
        )
      })
      expect(result.current.isDragOver).toBe(true)
    })

    it('does not set isDragOver=true for non-file drags', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      act(() => {
        result.current.dragHandlers.onDragEnter(
          makeDragEvent({ dataTransfer: { types: ['text'], files: [], dropEffect: '' } })
        )
      })
      expect(result.current.isDragOver).toBe(false)
    })

    it('calls preventDefault and stopPropagation', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      const event = makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
      act(() => {
        result.current.dragHandlers.onDragEnter(event)
      })
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    })

    it('increments internal counter on each enter (handles nested elements)', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      act(() => {
        result.current.dragHandlers.onDragEnter(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
        )
      })
      act(() => {
        result.current.dragHandlers.onDragEnter(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
        )
      })
      // Even after 2 enters and 1 leave, isDragOver should still be true
      act(() => {
        result.current.dragHandlers.onDragLeave(makeDragEvent())
      })
      expect(result.current.isDragOver).toBe(true)
    })
  })

  describe('onDragOver', () => {
    it('sets dropEffect to "copy" when files are being dragged', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      const event = makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
      act(() => {
        result.current.dragHandlers.onDragOver(event)
      })
      expect(event.dataTransfer.dropEffect).toBe('copy')
    })

    it('does not change dropEffect for non-file drags', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      const event = makeDragEvent({ dataTransfer: { types: ['text'], files: [], dropEffect: '' } })
      act(() => {
        result.current.dragHandlers.onDragOver(event)
      })
      expect(event.dataTransfer.dropEffect).toBe('')
    })
  })

  describe('onDragLeave', () => {
    it('clears isDragOver when counter reaches 0', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      act(() => {
        result.current.dragHandlers.onDragEnter(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
        )
      })
      expect(result.current.isDragOver).toBe(true)

      act(() => {
        result.current.dragHandlers.onDragLeave(makeDragEvent())
      })
      expect(result.current.isDragOver).toBe(false)
    })

    it('keeps isDragOver=true when there are unpaired enters', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      act(() => {
        result.current.dragHandlers.onDragEnter(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
        )
        result.current.dragHandlers.onDragEnter(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
        )
      })
      act(() => {
        result.current.dragHandlers.onDragLeave(makeDragEvent())
      })
      expect(result.current.isDragOver).toBe(true)
    })

    it('clamps counter to 0 (no negative values)', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      // Multiple leaves without enters
      act(() => {
        result.current.dragHandlers.onDragLeave(makeDragEvent())
        result.current.dragHandlers.onDragLeave(makeDragEvent())
      })
      expect(result.current.isDragOver).toBe(false)
    })
  })

  describe('onDrop', () => {
    it('calls onFileReceived with the dropped PDF file', () => {
      const onFileReceived = vi.fn()
      const { result } = renderHook(() => useSharedDragDrop(onFileReceived))
      const file = makeFile('test.pdf', '/path/to/test.pdf')
      act(() => {
        result.current.dragHandlers.onDrop(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [file], dropEffect: '' } })
        )
      })
      expect(onFileReceived).toHaveBeenCalledWith(file)
    })

    it('clears isDragOver on drop', () => {
      const { result } = renderHook(() => useSharedDragDrop(vi.fn()))
      const file = makeFile('test.pdf', '/path/to/test.pdf')
      act(() => {
        result.current.dragHandlers.onDragEnter(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
        )
      })
      expect(result.current.isDragOver).toBe(true)

      act(() => {
        result.current.dragHandlers.onDrop(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [file], dropEffect: '' } })
        )
      })
      expect(result.current.isDragOver).toBe(false)
    })

    it('filters to PDF files only', () => {
      const onFileReceived = vi.fn()
      const { result } = renderHook(() => useSharedDragDrop(onFileReceived))
      const txtFile = makeFile('test.txt', '/path/to/test.txt')
      act(() => {
        result.current.dragHandlers.onDrop(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [txtFile], dropEffect: '' } })
        )
      })
      expect(onFileReceived).not.toHaveBeenCalled()
    })

    it('is case-insensitive about file extension', () => {
      const onFileReceived = vi.fn()
      const { result } = renderHook(() => useSharedDragDrop(onFileReceived))
      const file = makeFile('TEST.PDF', '/path/to/TEST.PDF')
      act(() => {
        result.current.dragHandlers.onDrop(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [file], dropEffect: '' } })
        )
      })
      expect(onFileReceived).toHaveBeenCalledWith(file)
    })

    it('picks the first PDF when multiple files are dropped', () => {
      const onFileReceived = vi.fn()
      const { result } = renderHook(() => useSharedDragDrop(onFileReceived))
      const file1 = makeFile('first.pdf', '/path/first.pdf')
      const file2 = makeFile('second.pdf', '/path/second.pdf')
      act(() => {
        result.current.dragHandlers.onDrop(
          makeDragEvent({
            dataTransfer: { types: ['Files'], files: [file1, file2], dropEffect: '' }
          })
        )
      })
      expect(onFileReceived).toHaveBeenCalledWith(file1)
    })

    it('does not call onFileReceived when no PDF is dropped', () => {
      const onFileReceived = vi.fn()
      const { result } = renderHook(() => useSharedDragDrop(onFileReceived))
      act(() => {
        result.current.dragHandlers.onDrop(
          makeDragEvent({ dataTransfer: { types: ['Files'], files: [], dropEffect: '' } })
        )
      })
      expect(onFileReceived).not.toHaveBeenCalled()
    })
  })
})
