import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Logger } from '@shared/lib/logger'
import { safeWebviewPaste } from '@shared/lib/webviewUtils'
import type { WebviewController } from '@shared-core/types/webview'
import type { AiSendOptions, SendImageResult, SendTextResult } from '../model/types'
import {
    buildPromptText,
    CLIPBOARD_WAIT_DELAY,
    getCachedAiConfig,
    IMAGE_UPLOAD_WAIT_DELAY,
    isWebviewUsable,
    mergePromptText,
    POST_PASTE_PROMPT_DELAY,
    queueForWebview,
    sleep,
    toAutomationConfig,
    type AiConfig,
    type ConfigCache,
    type UseAiSenderReturn
} from '../lib/aiSenderSupport'
import { usePrompts } from './usePrompts'
import { useGenerateAutoSendScript, useGenerateClickSendScript, useGenerateFocusScript } from '@platform/electron/api/useAutomationApi'
import { useCopyImageToClipboard } from '@platform/electron/api/useSystemApi'

interface ResolvedSendContext {
    aiConfig: AiConfig
    currentUrl: string
}

function isSendError(result: ResolvedSendContext | SendTextResult): result is SendTextResult {
    return 'success' in result
}

export function useAiSender(
    webviewRef: RefObject<WebviewController | null>,
    currentAI: string,
    autoSend: boolean,
    aiRegistry: Record<string, AiConfig> | null
): UseAiSenderReturn {
    const { activePromptText } = usePrompts()
    const queryClient = useQueryClient()
    const { mutateAsync: generateAutoSendScript } = useGenerateAutoSendScript()
    const { mutateAsync: generateFocusScript } = useGenerateFocusScript()
    const { mutateAsync: generateClickSendScript } = useGenerateClickSendScript()
    const { mutateAsync: copyImageToClipboard } = useCopyImageToClipboard()
    const configCache = useRef<ConfigCache>({ key: null, data: null })

    const canUseWebview = useCallback((webview: WebviewController, expected?: WebviewController | null) => (
        isWebviewUsable(webviewRef, webview, expected)
    ), [webviewRef])

    const resolveSendContext = useCallback(async (
        webview: WebviewController,
        scheduledWebview: WebviewController
    ): Promise<ResolvedSendContext | SendTextResult> => {
        if (!aiRegistry) {
            return { success: false, error: 'registry_not_loaded' }
        }

        if (!canUseWebview(webview, scheduledWebview)) {
            return { success: false, error: 'webview_destroyed' }
        }

        const baseAiConfig = aiRegistry[currentAI]
        if (!baseAiConfig) {
            return { success: false, error: 'config_not_found' }
        }

        if (typeof webview.getURL !== 'function') {
            return { success: false, error: 'webview_api_missing' }
        }

        const { config: aiConfig, regex } = await getCachedAiConfig({
            baseConfig: baseAiConfig,
            configCache: configCache.current,
            currentAI,
            queryClient,
            webview
        })

        const currentUrl = webview.getURL()
        if (!currentUrl) {
            return { success: false, error: 'webview_url_missing' }
        }

        if (regex && !regex.test(currentUrl)) {
            return { success: false, error: 'wrong_url', actualUrl: currentUrl }
        }

        return { aiConfig, currentUrl }
    }, [aiRegistry, canUseWebview, currentAI, queryClient])

    const sendTextToAI = useCallback((text: string, options: AiSendOptions = {}): Promise<SendTextResult> => {
        const scheduledWebview = webviewRef.current
        if (!scheduledWebview || !text) {
            return Promise.resolve({ success: false, error: 'invalid_input' })
        }

        const execute = async (webview: WebviewController): Promise<SendTextResult> => {
            try {
                const resolved = await resolveSendContext(webview, scheduledWebview)
                if (isSendError(resolved)) {
                    return resolved
                }

                const effectiveAutoSend = options.autoSend ?? autoSend
                const finalPromptText = mergePromptText(activePromptText, options.promptText)
                const finalText = buildPromptText(text, finalPromptText)
                const script = await generateAutoSendScript({
                    config: toAutomationConfig(resolved.aiConfig),
                    text: finalText,
                    submit: effectiveAutoSend
                })

                if (!script) {
                    return { success: false, error: 'script_generation_failed' }
                }

                if (!canUseWebview(webview, scheduledWebview)) {
                    return { success: false, error: 'webview_destroyed' }
                }

                const result = await webview.executeJavaScript(script) as { success?: boolean; error?: string; mode?: string } | null
                if (!result || result.success === false) {
                    return { success: false, error: result?.error || 'script_failed' }
                }

                return { success: true, mode: result.mode || resolved.aiConfig.submitMode }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'unknown_error'
                Logger.error('[useAiSender] Hata:', error)
                return { success: false, error: message }
            }
        }

        return queueForWebview(scheduledWebview, async () => {
            try {
                return await execute(scheduledWebview)
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'queue_error' }
            }
        })
    }, [activePromptText, autoSend, canUseWebview, generateAutoSendScript, resolveSendContext, webviewRef])

    const sendImageToAI = useCallback((imageDataUrl: string, options: AiSendOptions = {}): Promise<SendImageResult> => {
        const scheduledWebview = webviewRef.current
        if (!scheduledWebview || !imageDataUrl) {
            return Promise.resolve({ success: false, error: 'invalid_input' })
        }

        const execute = async (webview: WebviewController): Promise<SendImageResult> => {
            if (!imageDataUrl.startsWith('data:image/')) {
                Logger.error('[useAiSender] Invalid image format')
                return { success: false, error: 'invalid_image_format' }
            }

            try {
                const resolved = await resolveSendContext(webview, scheduledWebview)
                if (isSendError(resolved)) {
                    return resolved
                }

                const effectiveAutoSend = options.autoSend ?? autoSend
                const effectivePromptText = mergePromptText(activePromptText, options.promptText)

                const copied = await copyImageToClipboard(imageDataUrl)
                if (!copied) {
                    return { success: false, error: 'clipboard_failed' }
                }

                try {
                    if (webview.isDestroyed?.() !== true && typeof webview.focus === 'function') {
                        webview.focus()
                    }
                } catch {
                    // Focus failure should not block the next fallback path.
                }

                await sleep(100)

                const focusScript = await generateFocusScript(toAutomationConfig(resolved.aiConfig))
                if (!focusScript) {
                    return { success: false, error: 'focus_script_failed' }
                }

                if (!canUseWebview(webview, scheduledWebview)) {
                    return { success: false, error: 'webview_destroyed' }
                }

                const focused = await webview.executeJavaScript(focusScript)
                if (!focused) {
                    return { success: false, error: 'focus_failed' }
                }

                await sleep(CLIPBOARD_WAIT_DELAY)

                let pasteSuccess = false
                if (canUseWebview(webview, scheduledWebview) && typeof webview.pasteNative === 'function' && typeof webview.getWebContentsId === 'function') {
                    try {
                        const webContentsId = webview.getWebContentsId()
                        if (webContentsId) {
                            const result = webview.pasteNative(webContentsId)
                            pasteSuccess = typeof result === 'boolean' ? result : await result
                        }
                    } catch {
                        pasteSuccess = false
                    }
                }

                if (!pasteSuccess) {
                    if (!canUseWebview(webview, scheduledWebview)) {
                        return { success: false, error: 'webview_destroyed' }
                    }
                    pasteSuccess = safeWebviewPaste(webview)
                }

                if (!pasteSuccess) {
                    return { success: false, error: 'paste_failed' }
                }

                if (effectivePromptText) {
                    await sleep(POST_PASTE_PROMPT_DELAY)

                    const promptScript = await generateAutoSendScript({
                        config: toAutomationConfig(resolved.aiConfig),
                        text: effectivePromptText,
                        submit: effectiveAutoSend
                    })

                    if (promptScript) {
                        if (!canUseWebview(webview, scheduledWebview)) {
                            return { success: false, error: 'webview_destroyed' }
                        }

                        const promptResult = await webview.executeJavaScript(promptScript) as { success?: boolean; error?: string } | boolean | null
                        if (promptResult === false || (typeof promptResult === 'object' && promptResult?.success === false)) {
                            return {
                                success: false,
                                error: typeof promptResult === 'object' && promptResult?.error
                                    ? promptResult.error
                                    : 'script_failed'
                            }
                        }

                        return { success: true, mode: effectiveAutoSend ? 'auto_click_with_prompt' : 'paste_and_prompt' }
                    }
                }

                if (effectiveAutoSend) {
                    await sleep(resolved.aiConfig.imageWaitTime || IMAGE_UPLOAD_WAIT_DELAY)

                    const clickScript = await generateClickSendScript(toAutomationConfig(resolved.aiConfig))
                    if (!clickScript) {
                        return { success: false, error: 'click_script_failed' }
                    }

                    if (!canUseWebview(webview, scheduledWebview)) {
                        return { success: false, error: 'webview_destroyed' }
                    }

                    const clickResult = await webview.executeJavaScript(clickScript)
                    if (!clickResult) {
                        return { success: false, error: 'autosend_failed_draft_saved' }
                    }

                    return { success: true, mode: 'auto_click' }
                }

                return { success: true, mode: 'paste_only' }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'unknown_error'
                Logger.error('[useAiSender] Image send error:', error)
                return { success: false, error: message }
            }
        }

        return queueForWebview(scheduledWebview, async () => {
            try {
                return await execute(scheduledWebview)
            } catch (error) {
                Logger.error('[useAiSender] Image queue error:', error)
                return { success: false, error: error instanceof Error ? error.message : 'queue_error' }
            }
        })
    }, [
        activePromptText,
        autoSend,
        canUseWebview,
        copyImageToClipboard,
        generateAutoSendScript,
        generateClickSendScript,
        generateFocusScript,
        resolveSendContext,
        webviewRef
    ])

    return { sendTextToAI, sendImageToAI }
}
