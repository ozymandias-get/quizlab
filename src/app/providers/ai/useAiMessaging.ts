import { useCallback, useMemo } from 'react'
import { useAiSender } from '@features/ai/hooks/useAiSender'
import type { AiSendOptions } from '@features/ai'
import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

interface UseAiMessagingParams {
    webviewInstance: WebviewController | null
    currentAI: string
    autoSend: boolean
    aiRegistry: Record<string, AiPlatform>
    showSuccess: (message: string, title?: string) => void
    showWarning: (message: string, title?: string) => void
}

export function useAiMessaging({
    webviewInstance,
    currentAI,
    autoSend,
    aiRegistry,
    showSuccess,
    showWarning
}: UseAiMessagingParams) {
    const webviewRefProxy = useMemo(() => ({ current: webviewInstance }), [webviewInstance])
    const {
        sendTextToAI: rawSendText,
        sendImageToAI: rawSendImage
    } = useAiSender(webviewRefProxy, currentAI, autoSend, aiRegistry)

    const sendTextToAI = useCallback(async (text: string, options?: AiSendOptions) => {
        const result = await rawSendText(text, options)
        if (!result.success) {
            showWarning(`error_${result.error}`)
        }
        return result
    }, [rawSendText, showWarning])

    const sendImageToAI = useCallback(async (imageData: string, options?: AiSendOptions) => {
        const result = await rawSendImage(imageData, options)
        if (result.success) {
            showSuccess('sent_successfully')
        } else {
            showWarning(`error_${result.error}`)
        }
        return result
    }, [rawSendImage, showSuccess, showWarning])

    return {
        sendTextToAI,
        sendImageToAI
    }
}
