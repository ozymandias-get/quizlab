import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppToolProvider, useAppTools } from '@app/providers/AppToolContext'

const mockSendTextToAI = vi.fn()
const mockSendImageToAI = vi.fn()

vi.mock('@app/providers/AiContext', () => ({
    useAiActions: () => ({
        sendTextToAI: mockSendTextToAI,
        sendImageToAI: mockSendImageToAI
    }),
    useAiState: () => ({
        webviewInstance: null,
        autoSend: false
    })
}))

vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
    useScreenshot: () => ({
        isScreenshotMode: false,
        startScreenshot: vi.fn(),
        closeScreenshot: vi.fn(),
        handleCapture: vi.fn()
    })
}))

vi.mock('@features/automation/hooks/useElementPicker', () => ({
    useElementPicker: () => ({
        isPickerActive: false,
        startPicker: vi.fn(),
        togglePicker: vi.fn()
    })
}))

vi.mock('@platform/electron/api/useGeminiWebSessionApi', () => ({
    useGeminiWebOpenLogin: () => ({
        mutateAsync: vi.fn(),
        isPending: false
    })
}))

describe('AppToolContext', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppToolProvider>{children}</AppToolProvider>
    )
    const mockRemoveAllRanges = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        Object.defineProperty(window, 'getSelection', {
            configurable: true,
            value: vi.fn(() => ({
                rangeCount: 1,
                removeAllRanges: mockRemoveAllRanges
            }))
        })
    })

    it('queues multiple text and image items', () => {
        const { result } = renderHook(() => useAppTools(), { wrapper })

        act(() => {
            result.current.queueTextForAi('First excerpt')
            result.current.queueTextForAi('Second excerpt')
            result.current.queueImageForAi('data:image/png;base64,one', {
                page: 12,
                captureKind: 'selection'
            })
        })

        expect(result.current.pendingAiItems).toHaveLength(3)
        expect(result.current.pendingAiItems[2]).toEqual(expect.objectContaining({
            type: 'image',
            page: 12,
            captureKind: 'selection'
        }))
    })

    it('sends multiple images sequentially and adds prompt text on the last image', async () => {
        mockSendImageToAI.mockResolvedValue({ success: true, mode: 'paste_only' })
        const { result } = renderHook(() => useAppTools(), { wrapper })

        act(() => {
            result.current.queueTextForAi('First excerpt')
            result.current.queueTextForAi('Second excerpt')
            result.current.queueImageForAi('data:image/png;base64,one')
            result.current.queueImageForAi('data:image/png;base64,two')
        })

        await act(async () => {
            await result.current.sendPendingAiItems({ promptText: 'Summarize these', autoSend: true })
        })

        expect(mockSendImageToAI).toHaveBeenNthCalledWith(1, 'data:image/png;base64,one', {
            autoSend: false,
            promptText: undefined
        })
        expect(mockSendImageToAI).toHaveBeenNthCalledWith(2, 'data:image/png;base64,two', {
            autoSend: true,
            promptText: 'Summarize these\n\nFirst excerpt\n\n---\n\nSecond excerpt'
        })
    })

    it('sends text-only drafts as a single message', async () => {
        mockSendTextToAI.mockResolvedValue({ success: true, mode: 'mixed' })
        const { result } = renderHook(() => useAppTools(), { wrapper })

        act(() => {
            result.current.queueTextForAi('Only excerpt')
        })

        await act(async () => {
            await result.current.sendPendingAiItems({ promptText: 'Explain this', autoSend: true })
        })

        expect(mockSendTextToAI).toHaveBeenCalledWith('Explain this\n\nOnly excerpt', {
            autoSend: true
        })
    })

    it('clears DOM text selection when pending items are dismissed', () => {
        const { result } = renderHook(() => useAppTools(), { wrapper })

        act(() => {
            result.current.queueTextForAi('Dismiss me')
        })

        act(() => {
            result.current.clearPendingAiItems()
        })

        expect(mockRemoveAllRanges).toHaveBeenCalledTimes(1)
        expect(result.current.pendingAiItems).toHaveLength(0)
    })
})
