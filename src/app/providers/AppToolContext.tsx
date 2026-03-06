import React, { createContext, useCallback, useContext } from 'react'
import { useScreenshot } from '@features/screenshot'
import { useAi } from './AiContext'
import { useElementPicker } from '@features/automation'
import { useGeminiWebOpenLogin } from '@platform/electron/api/useGeminiWebSessionApi'
import type { GeminiWebSessionActionResult } from '@shared-core/types'

interface AppToolContextType {
    isScreenshotMode: boolean;
    startScreenshot: (mode?: 'full' | 'crop') => void;
    closeScreenshot: () => void;
    handleCapture: (dataUrl: string) => void;
    isPickerActive: boolean;
    startPicker: () => void;
    togglePicker: () => void;
    isGeminiWebLoginInProgress: boolean;
    startGeminiWebLogin: () => Promise<GeminiWebSessionActionResult>;
}

const AppToolContext = createContext<AppToolContextType | null>(null)

export function AppToolProvider({ children }: { children: React.ReactNode }) {
    const { sendImageToAI, webviewInstance } = useAi()

    const { isScreenshotMode, startScreenshot, closeScreenshot, handleCapture } = useScreenshot(sendImageToAI)
    const { isPickerActive, startPicker, togglePicker } = useElementPicker(webviewInstance)
    const { mutateAsync: openGeminiWebLogin, isPending: isGeminiWebLoginInProgress } = useGeminiWebOpenLogin()

    const startGeminiWebLogin = useCallback(() => openGeminiWebLogin(), [openGeminiWebLogin])

    const value = React.useMemo(() => ({
        isScreenshotMode,
        startScreenshot,
        closeScreenshot,
        handleCapture,
        isPickerActive,
        startPicker,
        togglePicker,
        isGeminiWebLoginInProgress,
        startGeminiWebLogin
    }), [
        closeScreenshot,
        handleCapture,
        isGeminiWebLoginInProgress,
        isPickerActive,
        isScreenshotMode,
        startGeminiWebLogin,
        startPicker,
        startScreenshot,
        togglePicker
    ])

    return (
        <AppToolContext.Provider value={value}>
            {children}
        </AppToolContext.Provider>
    )
}

export const useAppTools = () => {
    const context = useContext(AppToolContext)
    if (!context) throw new Error('useAppTools must be used within AppToolProvider')
    return context
}
