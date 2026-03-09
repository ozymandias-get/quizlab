import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
    AutomationExecutionDiagnostics,
    AutomationExecutionResult
} from '@shared-core/types'
import { Logger } from '@shared/lib/logger'
import { safeWebviewPaste } from '@shared/lib/webviewUtils'
import type { WebviewController } from '@shared-core/types/webview'
import type {
    AiSendDiagnostics,
    AiSendOptions,
    SendImageResult,
    SendTextResult
} from '../model/types'
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
import {
    useGenerateAutoSendScript,
    useGenerateClickSendScript,
    useGenerateFocusScript
} from '@platform/electron/api/useAutomationApi'
import { useCopyImageToClipboard } from '@platform/electron/api/useSystemApi'

interface ResolvedSendContext {
    aiConfig: AiConfig
    currentUrl: string
}

interface SendDiagnosticsOptions {
    pipeline: 'text' | 'image'
    currentAI: string
    activeTabId?: string
    autoSend: boolean
}

function isSendError(result: ResolvedSendContext | SendTextResult): result is SendTextResult {
    return 'success' in result
}

function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
}

function roundMs(value: number) {
    return Math.round(value * 100) / 100
}

function createSendDiagnostics({
    pipeline,
    currentAI,
    activeTabId,
    autoSend
}: SendDiagnosticsOptions): AiSendDiagnostics {
    return {
        pipeline,
        tabId: activeTabId,
        currentAI,
        autoSend,
        timings: {
            queueWaitMs: 0,
            configResolveMs: 0,
            totalMs: 0
        }
    }
}

function finalizeDiagnostics(diagnostics: AiSendDiagnostics, requestStartedAt: number) {
    diagnostics.timings.totalMs = roundMs(nowMs() - requestStartedAt)
    return diagnostics
}

function attachDiagnostics<T extends SendTextResult | SendImageResult>(
    result: T,
    diagnostics: AiSendDiagnostics,
    requestStartedAt: number
): T {
    return {
        ...result,
        diagnostics: finalizeDiagnostics(diagnostics, requestStartedAt)
    }
}

function normalizeExecutionResult(value: unknown): AutomationExecutionResult | null {
    if (typeof value === 'boolean') {
        return { success: value }
    }

    if (!value || typeof value !== 'object') {
        return null
    }

    const candidate = value as Partial<AutomationExecutionResult>
    return {
        success: typeof candidate.success === 'boolean'
            ? candidate.success
            : !candidate.error,
        error: candidate.error,
        mode: candidate.mode,
        action: candidate.action,
        diagnostics: candidate.diagnostics
    }
}

function cloneScriptDiagnostics(
    diagnostics?: AutomationExecutionDiagnostics | null
): AutomationExecutionDiagnostics | null {
    return diagnostics
        ? JSON.parse(JSON.stringify(diagnostics)) as AutomationExecutionDiagnostics
        : null
}

export function useAiSender(
    webviewRef: RefObject<WebviewController | null>,
    currentAI: string,
    autoSend: boolean,
    aiRegistry: Record<string, AiConfig> | null,
    activeTabId?: string
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
        const requestStartedAt = nowMs()
        const effectiveAutoSend = options.autoSend ?? autoSend
        const diagnostics = createSendDiagnostics({
            pipeline: 'text',
            currentAI,
            activeTabId,
            autoSend: effectiveAutoSend
        })

        if (!scheduledWebview || !text) {
            return Promise.resolve(attachDiagnostics(
                { success: false, error: 'invalid_input' },
                diagnostics,
                requestStartedAt
            ))
        }

        const execute = async (webview: WebviewController): Promise<SendTextResult> => {
            diagnostics.timings.queueWaitMs = roundMs(nowMs() - requestStartedAt)

            try {
                const resolveStartedAt = nowMs()
                const resolved = await resolveSendContext(webview, scheduledWebview)
                diagnostics.timings.configResolveMs = roundMs(nowMs() - resolveStartedAt)

                if (isSendError(resolved)) {
                    if (resolved.actualUrl) {
                        diagnostics.currentUrl = resolved.actualUrl
                    }

                    return attachDiagnostics(resolved, diagnostics, requestStartedAt)
                }

                diagnostics.currentUrl = resolved.currentUrl

                const finalPromptText = mergePromptText(activePromptText, options.promptText)
                const finalText = buildPromptText(text, finalPromptText)

                const scriptGenerationStartedAt = nowMs()
                const script = await generateAutoSendScript({
                    config: toAutomationConfig(resolved.aiConfig),
                    text: finalText,
                    submit: effectiveAutoSend
                })
                diagnostics.timings.scriptGenerationMs = roundMs(nowMs() - scriptGenerationStartedAt)

                if (!script) {
                    return attachDiagnostics(
                        { success: false, error: 'script_generation_failed' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                if (!canUseWebview(webview, scheduledWebview)) {
                    return attachDiagnostics(
                        { success: false, error: 'webview_destroyed' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                const executeStartedAt = nowMs()
                const rawResult = await webview.executeJavaScript(script)
                diagnostics.timings.executeJavaScriptMs = roundMs(nowMs() - executeStartedAt)

                const scriptResult = normalizeExecutionResult(rawResult)
                diagnostics.script = cloneScriptDiagnostics(scriptResult?.diagnostics)

                if (!scriptResult || scriptResult.success === false) {
                    return attachDiagnostics(
                        { success: false, error: scriptResult?.error || 'script_failed' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                return attachDiagnostics({
                    success: true,
                    mode: scriptResult.mode || resolved.aiConfig.submitMode
                }, diagnostics, requestStartedAt)
            } catch (error) {
                const message = error instanceof Error ? error.message : 'unknown_error'
                Logger.error('[useAiSender] Hata:', error)
                return attachDiagnostics(
                    { success: false, error: message },
                    diagnostics,
                    requestStartedAt
                )
            }
        }

        return queueForWebview(scheduledWebview, async () => {
            try {
                return await execute(scheduledWebview)
            } catch (error) {
                return attachDiagnostics(
                    { success: false, error: error instanceof Error ? error.message : 'queue_error' },
                    diagnostics,
                    requestStartedAt
                )
            }
        })
    }, [
        activePromptText,
        activeTabId,
        autoSend,
        canUseWebview,
        currentAI,
        generateAutoSendScript,
        resolveSendContext,
        webviewRef
    ])

    const sendImageToAI = useCallback((imageDataUrl: string, options: AiSendOptions = {}): Promise<SendImageResult> => {
        const scheduledWebview = webviewRef.current
        const requestStartedAt = nowMs()
        const effectiveAutoSend = options.autoSend ?? autoSend
        const diagnostics = createSendDiagnostics({
            pipeline: 'image',
            currentAI,
            activeTabId,
            autoSend: effectiveAutoSend
        })

        if (!scheduledWebview || !imageDataUrl) {
            return Promise.resolve(attachDiagnostics(
                { success: false, error: 'invalid_input' },
                diagnostics,
                requestStartedAt
            ))
        }

        const execute = async (webview: WebviewController): Promise<SendImageResult> => {
            diagnostics.timings.queueWaitMs = roundMs(nowMs() - requestStartedAt)

            if (!imageDataUrl.startsWith('data:image/')) {
                Logger.error('[useAiSender] Invalid image format')
                return attachDiagnostics(
                    { success: false, error: 'invalid_image_format' },
                    diagnostics,
                    requestStartedAt
                )
            }

            try {
                const resolveStartedAt = nowMs()
                const resolved = await resolveSendContext(webview, scheduledWebview)
                diagnostics.timings.configResolveMs = roundMs(nowMs() - resolveStartedAt)

                if (isSendError(resolved)) {
                    if (resolved.actualUrl) {
                        diagnostics.currentUrl = resolved.actualUrl
                    }

                    return attachDiagnostics(resolved, diagnostics, requestStartedAt)
                }

                diagnostics.currentUrl = resolved.currentUrl
                const effectivePromptText = mergePromptText(activePromptText, options.promptText)

                const clipboardStartedAt = nowMs()
                const copied = await copyImageToClipboard(imageDataUrl)
                diagnostics.timings.clipboardMs = roundMs(nowMs() - clipboardStartedAt)
                if (!copied) {
                    return attachDiagnostics(
                        { success: false, error: 'clipboard_failed' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                try {
                    if (webview.isDestroyed?.() !== true && typeof webview.focus === 'function') {
                        webview.focus()
                    }
                } catch {
                    // Focus failure should not block the next fallback path.
                }

                await sleep(100)

                const focusScriptGenerationStartedAt = nowMs()
                const focusScript = await generateFocusScript(toAutomationConfig(resolved.aiConfig))
                diagnostics.timings.focusScriptGenerationMs = roundMs(nowMs() - focusScriptGenerationStartedAt)
                if (!focusScript) {
                    return attachDiagnostics(
                        { success: false, error: 'focus_script_failed' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                if (!canUseWebview(webview, scheduledWebview)) {
                    return attachDiagnostics(
                        { success: false, error: 'webview_destroyed' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                const focusExecuteStartedAt = nowMs()
                const rawFocusResult = await webview.executeJavaScript(focusScript)
                diagnostics.timings.focusExecuteJavaScriptMs = roundMs(nowMs() - focusExecuteStartedAt)
                const focusResult = normalizeExecutionResult(rawFocusResult)
                diagnostics.focusScript = cloneScriptDiagnostics(focusResult?.diagnostics)
                if (!focusResult?.success) {
                    return attachDiagnostics(
                        { success: false, error: focusResult?.error || 'focus_failed' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                await sleep(CLIPBOARD_WAIT_DELAY)

                let pasteSuccess = false
                const pasteStartedAt = nowMs()
                if (
                    canUseWebview(webview, scheduledWebview)
                    && typeof webview.pasteNative === 'function'
                    && typeof webview.getWebContentsId === 'function'
                ) {
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
                        return attachDiagnostics(
                            { success: false, error: 'webview_destroyed' },
                            diagnostics,
                            requestStartedAt
                        )
                    }
                    pasteSuccess = safeWebviewPaste(webview)
                }
                diagnostics.timings.pasteMs = roundMs(nowMs() - pasteStartedAt)

                if (!pasteSuccess) {
                    return attachDiagnostics(
                        { success: false, error: 'paste_failed' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                if (effectivePromptText) {
                    await sleep(POST_PASTE_PROMPT_DELAY)
                    diagnostics.timings.postPastePromptDelayMs = POST_PASTE_PROMPT_DELAY

                    const promptScriptGenerationStartedAt = nowMs()
                    const promptScript = await generateAutoSendScript({
                        config: toAutomationConfig(resolved.aiConfig),
                        text: effectivePromptText,
                        submit: effectiveAutoSend
                    })
                    diagnostics.timings.promptScriptGenerationMs = roundMs(nowMs() - promptScriptGenerationStartedAt)

                    if (promptScript) {
                        if (!canUseWebview(webview, scheduledWebview)) {
                            return attachDiagnostics(
                                { success: false, error: 'webview_destroyed' },
                                diagnostics,
                                requestStartedAt
                            )
                        }

                        const promptExecuteStartedAt = nowMs()
                        const rawPromptResult = await webview.executeJavaScript(promptScript)
                        diagnostics.timings.promptExecuteJavaScriptMs = roundMs(nowMs() - promptExecuteStartedAt)
                        const promptResult = normalizeExecutionResult(rawPromptResult)
                        diagnostics.promptScript = cloneScriptDiagnostics(promptResult?.diagnostics)
                        if (!promptResult?.success) {
                            return attachDiagnostics(
                                { success: false, error: promptResult?.error || 'script_failed' },
                                diagnostics,
                                requestStartedAt
                            )
                        }

                        return attachDiagnostics(
                            {
                                success: true,
                                mode: effectiveAutoSend ? 'auto_click_with_prompt' : 'paste_and_prompt'
                            },
                            diagnostics,
                            requestStartedAt
                        )
                    }
                }

                if (effectiveAutoSend) {
                    await sleep(resolved.aiConfig.imageWaitTime || IMAGE_UPLOAD_WAIT_DELAY)
                    diagnostics.timings.imageUploadWaitMs = resolved.aiConfig.imageWaitTime || IMAGE_UPLOAD_WAIT_DELAY

                    const clickScriptGenerationStartedAt = nowMs()
                    const clickScript = await generateClickSendScript(toAutomationConfig(resolved.aiConfig))
                    diagnostics.timings.clickScriptGenerationMs = roundMs(nowMs() - clickScriptGenerationStartedAt)
                    if (!clickScript) {
                        return attachDiagnostics(
                            { success: false, error: 'click_script_failed' },
                            diagnostics,
                            requestStartedAt
                        )
                    }

                    if (!canUseWebview(webview, scheduledWebview)) {
                        return attachDiagnostics(
                            { success: false, error: 'webview_destroyed' },
                            diagnostics,
                            requestStartedAt
                        )
                    }

                    const clickExecuteStartedAt = nowMs()
                    const rawClickResult = await webview.executeJavaScript(clickScript)
                    diagnostics.timings.clickExecuteJavaScriptMs = roundMs(nowMs() - clickExecuteStartedAt)
                    const clickResult = normalizeExecutionResult(rawClickResult)
                    diagnostics.clickScript = cloneScriptDiagnostics(clickResult?.diagnostics)
                    if (!clickResult?.success) {
                        return attachDiagnostics(
                            { success: false, error: clickResult?.error || 'autosend_failed_draft_saved' },
                            diagnostics,
                            requestStartedAt
                        )
                    }

                    return attachDiagnostics(
                        { success: true, mode: 'auto_click' },
                        diagnostics,
                        requestStartedAt
                    )
                }

                return attachDiagnostics(
                    { success: true, mode: 'paste_only' },
                    diagnostics,
                    requestStartedAt
                )
            } catch (error) {
                const message = error instanceof Error ? error.message : 'unknown_error'
                Logger.error('[useAiSender] Image send error:', error)
                return attachDiagnostics(
                    { success: false, error: message },
                    diagnostics,
                    requestStartedAt
                )
            }
        }

        return queueForWebview(scheduledWebview, async () => {
            try {
                return await execute(scheduledWebview)
            } catch (error) {
                Logger.error('[useAiSender] Image queue error:', error)
                return attachDiagnostics(
                    { success: false, error: error instanceof Error ? error.message : 'queue_error' },
                    diagnostics,
                    requestStartedAt
                )
            }
        })
    }, [
        activePromptText,
        activeTabId,
        autoSend,
        canUseWebview,
        copyImageToClipboard,
        currentAI,
        generateAutoSendScript,
        generateClickSendScript,
        generateFocusScript,
        resolveSendContext,
        webviewRef
    ])

    return { sendTextToAI, sendImageToAI }
}
