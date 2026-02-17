import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTextSelection } from '@src/hooks/useTextSelection'

// Mock useAi
const mockSendTextToAI = vi.fn().mockResolvedValue({ success: true })

vi.mock('@src/app/providers', () => ({
    useAi: () => ({
        sendTextToAI: mockSendTextToAI,
    }),
}))

describe('useTextSelection Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should initialize with empty selection', () => {
        const { result } = renderHook(() => useTextSelection())
        expect(result.current.selectedText).toBe('')
        expect(result.current.selectionPosition).toBeNull()
    })

    it('should update selection state when handleTextSelection is called', () => {
        const { result } = renderHook(() => useTextSelection())

        act(() => {
            result.current.handleTextSelection('Selected Text', { top: 100, left: 100 })
        })

        expect(result.current.selectedText).toBe('Selected Text')
        expect(result.current.selectionPosition).toEqual({ top: 100, left: 100 })
    })

    it('should send text to AI and clear selection on success', async () => {
        const { result } = renderHook(() => useTextSelection())

        act(() => {
            result.current.handleTextSelection('Question text', { top: 100, left: 100 })
        })

        await act(async () => {
            await result.current.handleSendToAI()
        })

        expect(mockSendTextToAI).toHaveBeenCalledWith('Question text')
        expect(result.current.selectedText).toBe('')
        expect(result.current.selectionPosition).toBeNull()
    })

    it('should not send empty text to AI', async () => {
        const { result } = renderHook(() => useTextSelection())

        await act(async () => {
            await result.current.handleSendToAI()
        })

        expect(mockSendTextToAI).not.toHaveBeenCalled()
    })

    it('should handle API failure gracefully (keep selection)', async () => {
        mockSendTextToAI.mockRejectedValueOnce(new Error('AI Failed'))
        const { result } = renderHook(() => useTextSelection())

        act(() => {
            result.current.handleTextSelection('Failed text', { top: 100, left: 100 })
        })

        await act(async () => {
            await result.current.handleSendToAI()
        })

        expect(mockSendTextToAI).toHaveBeenCalledWith('Failed text')
        // Should keep selection if failed (or implementation might not handle it explicitly to keep, checking code...)
        // Implementation: catch (error) { Logger.error(...) } -> doesn't clear selection.
        expect(result.current.selectedText).toBe('Failed text')
    })
})
