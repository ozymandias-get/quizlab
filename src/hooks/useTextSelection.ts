import { useState, useCallback } from 'react'
import { useAi } from '@src/app/providers'
import { Logger } from '@src/utils/logger'

export function useTextSelection() {
    const { sendTextToAI } = useAi()
    const [selectedText, setSelectedText] = useState<string>('')
    const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null)

    const handleTextSelection = useCallback((text: string, position: { top: number; left: number } | null) => {
        setSelectedText(text)
        setSelectionPosition(position)
    }, [])

    const handleSendToAI = useCallback(async () => {
        if (!selectedText) {
            Logger.warn('No text selected to send to AI')
            return
        }

        try {
            const result = await sendTextToAI(selectedText)
            if (result.success) {
                setSelectedText('')
                setSelectionPosition(null)
            }
        } catch (error) {
            Logger.error('Failed to send text to AI:', error)
        }
    }, [selectedText, sendTextToAI])

    const clearSelection = useCallback(() => {
        setSelectedText('')
        setSelectionPosition(null)
    }, [])

    return {
        selectedText,
        selectionPosition,
        handleTextSelection,
        handleSendToAI,
        clearSelection
    }
}
