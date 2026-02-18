import { useCallback, useRef, RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Logger } from '@src/utils/logger'
import { safeWebviewPaste } from '@src/utils/webviewUtils'
import { usePrompts } from './usePrompts'
import type { WebviewController } from '@shared/types/webview'
import { AI_CONFIG_KEY } from '@platform/electron/api/useAiApi'
import { useGenerateAutoSendScript, useGenerateFocusScript, useGenerateClickSendScript } from '@platform/electron/api/useAutomationApi'
import { useCopyImageToClipboard } from '@platform/electron/api/useSystemApi'

// Define interfaces for config
interface AiConfig {
    input?: string | null;
    button?: string | null;
    submitMode?: string;
    domainRegex?: string;
    imageWaitTime?: number;
    [key: string]: unknown;
}

interface CacheData {
    config: AiConfig;
    regex: RegExp | null;
}

interface ConfigCache {
    key: string | null;
    data: CacheData | null;
}

export interface SendTextResult {
    success: boolean;
    error?: string;
    mode?: string;
    actualUrl?: string;
}

export interface SendImageResult {
    success: boolean;
    error?: string;
    mode?: string;
}

interface UseAiSenderReturn {
    sendTextToAI: (text: string) => Promise<SendTextResult>;
    sendImageToAI: (imageDataUrl: string) => Promise<SendImageResult>;
}

const CLIPBOARD_WAIT_DELAY = 800

export function useAiSender(
    webviewRef: RefObject<WebviewController | null>,
    currentAI: string,
    autoSend: boolean,
    aiRegistry: Record<string, AiConfig> | null
): UseAiSenderReturn {
    // Modular prompt logic
    const { activePromptText } = usePrompts()
    const queryClient = useQueryClient()

    // React Query Mutations
    const { mutateAsync: generateAutoSendScript } = useGenerateAutoSendScript()
    const { mutateAsync: generateFocusScript } = useGenerateFocusScript()
    const { mutateAsync: generateClickSendScript } = useGenerateClickSendScript()
    const { mutateAsync: copyImageToClipboard } = useCopyImageToClipboard()

    // Cache to avoid re-fetching/calculating config for the same URL
    const configCache = useRef<ConfigCache>({ key: null, data: null })

    const getCachedConfig = useCallback(async (client: ReturnType<typeof useQueryClient>, webview: WebviewController, baseConfig: AiConfig): Promise<CacheData> => {
        if (!webview || typeof webview.getURL !== 'function') return { config: baseConfig, regex: null }

        const currentUrl = webview.getURL()
        if (!currentUrl) return { config: baseConfig, regex: null }
        const configSignature = JSON.stringify(baseConfig || {})
        const cacheKey = `${currentUrl}::${currentAI}::${configSignature}`

        if (configCache.current.key === cacheKey && configCache.current.data) {
            return configCache.current.data
        }

        try {
            const hostname = new URL(currentUrl).hostname
            // Fetch dynamically using React Query (allows caching)
            // Note: Utilizing window.electronAPI inside queryFn is acceptable as an implementation detail
            // to fetch data, leveraging React Query for cache management.
            const customConfig = await client.fetchQuery({
                queryKey: AI_CONFIG_KEY(hostname),
                queryFn: () => window.electronAPI.getAiConfig(hostname),
                staleTime: 1000 * 60 * 5 // 5 minutes fresh
            }) as AiConfig | null

            const selectorConfig = (customConfig && typeof customConfig === 'object' && 'input' in customConfig)
                ? (customConfig)
                : null

            let finalConfig = baseConfig
            if (selectorConfig && selectorConfig.input && selectorConfig.button) {
                Logger.info('[useAiSender] Using custom selectors for:', hostname)
                finalConfig = {
                    ...baseConfig,
                    input: selectorConfig.input,
                    button: selectorConfig.button,
                    submitMode: selectorConfig.submitMode || baseConfig.submitMode || 'click'
                }
            }

            let regex: RegExp | null = null
            if (finalConfig.domainRegex) {
                regex = new RegExp(finalConfig.domainRegex)
            }

            const data = { config: finalConfig, regex }
            configCache.current = { key: cacheKey, data }
            return data

        } catch (e) {
            // Ignore errors
            return { config: baseConfig, regex: null }
        }
    }, [currentAI])

    const sendTextToAI = useCallback(async (text: string): Promise<SendTextResult> => {
        const webview = webviewRef.current
        if (!webview || !text) return { success: false, error: 'invalid_input' }
        if (!aiRegistry) return { success: false, error: 'registry_not_loaded' }

        try {
            // Get base config from registry
            let baseAiConfig = aiRegistry[currentAI]
            if (!baseAiConfig) return { success: false, error: 'config_not_found' }

            if (typeof webview.getURL !== 'function') {
                return { success: false, error: 'webview_api_missing' }
            }

            // Get config + regex (cached if possible)
            const { config: aiConfig, regex } = await getCachedConfig(queryClient, webview, baseAiConfig)
            const currentUrl = webview.getURL()
            if (!currentUrl) {
                return { success: false, error: 'webview_url_missing' }
            }

            if (regex) {
                if (!regex.test(currentUrl)) {
                    return { success: false, error: 'wrong_url', actualUrl: currentUrl }
                }
            }

            // Prepend prompt if selected
            let finalText = text
            if (activePromptText) {
                // Add prompt before the text
                finalText = `${activePromptText}\n\n${text}`
                Logger.info('[useAiSender] Prompt prepended:', activePromptText)
            }

            // Use React Query mutation instead of direct API call
            const script = await generateAutoSendScript({
                config: aiConfig as any, // Cast to match AutomationConfig if needed
                text: finalText,
                submit: autoSend
            })

            if (!script) return { success: false, error: 'script_generation_failed' }

            if (webview.isDestroyed?.() === true) return { success: false, error: 'webview_destroyed' }

            const result = await webview.executeJavaScript(script) as { success?: boolean; error?: string; mode?: string } | null
            if (!result || result.success === false) {
                return { success: false, error: result?.error || 'script_failed' }
            }

            return { success: true, mode: result.mode || aiConfig.submitMode }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_error'
            Logger.error('[useAiSender] Hata:', error)
            return { success: false, error: message }
        }
    }, [currentAI, autoSend, webviewRef, aiRegistry, getCachedConfig, activePromptText, queryClient, generateAutoSendScript])

    const sendImageToAI = useCallback(async (imageDataUrl: string): Promise<SendImageResult> => {
        const webview = webviewRef.current
        if (!webview || !imageDataUrl) return { success: false, error: 'invalid_input' }
        if (!aiRegistry) return { success: false, error: 'registry_not_loaded' }

        // Sanity check for data URL
        if (!imageDataUrl.startsWith('data:image/')) {
            Logger.error('[useAiSender] Geçersiz resim formatý')
            return { success: false, error: 'invalid_image_format' }
        }

        try {
            // Get base config from registry
            let baseAiConfig = aiRegistry[currentAI]
            if (!baseAiConfig) return { success: false, error: 'config_not_found' }

            // Get config (cached if possible)
            const { config: aiConfig } = await getCachedConfig(queryClient, webview, baseAiConfig)

            // Use React Query mutation
            const copied = await copyImageToClipboard(imageDataUrl)
            if (!copied) return { success: false, error: 'clipboard_failed' }

            // Focus webview
            try {
                if (webview.isDestroyed?.() !== true && typeof webview.focus === 'function') {
                    webview.focus()
                }
            } catch (e) { }

            await new Promise(r => setTimeout(r, 100))

            // Use React Query mutation
            const focusScript = await generateFocusScript(aiConfig as any)
            if (!focusScript) return { success: false, error: 'focus_script_failed' }

            if (webview.isDestroyed?.() === true) return { success: false, error: 'webview_destroyed' }
            const focused = await webview.executeJavaScript(focusScript)
            if (!focused) return { success: false, error: 'focus_failed' }

            // Wait for clipboard to be ready in the remote process
            await new Promise(r => setTimeout(r, CLIPBOARD_WAIT_DELAY))

            let pasteSuccess = false

            // Try native paste if available
            if (webview.isDestroyed?.() !== true) {
                if ((webview as any).pasteNative && typeof (webview as any).getWebContentsId === 'function') {
                    try {
                        const wcId = (webview as any).getWebContentsId()
                        if (wcId) {
                            const result = (webview as any).pasteNative(wcId)
                            pasteSuccess = typeof result === 'boolean' ? result : await result
                        }
                    } catch (err) {
                        pasteSuccess = false
                    }
                }
            }

            // Fallback to JS paste
            if (!pasteSuccess) {
                if (webview.isDestroyed?.() === true) return { success: false, error: 'webview_destroyed' }
                pasteSuccess = safeWebviewPaste(webview)
            }

            if (!pasteSuccess) return { success: false, error: 'paste_failed' }

            // Perform prompt injection for image
            if (activePromptText) {
                // Wait slightly for paste to settle
                await new Promise(r => setTimeout(r, 500))

                // Use the same auto-send script logic to insert the prompt text
                // If autoSend is true, this will also click send
                // Use React Query mutation
                const promptScript = await generateAutoSendScript({
                    config: aiConfig as any,
                    text: activePromptText,
                    submit: autoSend
                })

                if (promptScript) {
                    if (webview.isDestroyed?.() === true) return { success: false, error: 'webview_destroyed' }
                    const promptResult = await webview.executeJavaScript(promptScript) as { success?: boolean; error?: string } | boolean | null
                    if (promptResult === false || (typeof promptResult === 'object' && promptResult?.success === false)) {
                        return { success: false, error: (typeof promptResult === 'object' && promptResult?.error) ? promptResult.error : 'script_failed' }
                    }
                    return { success: true, mode: autoSend ? 'auto_click_with_prompt' : 'paste_and_prompt' }
                }
            }

            if (autoSend) {
                // Wait for image to upload/process in the AI interface
                let waitTime = aiConfig.imageWaitTime || 1000
                await new Promise(r => setTimeout(r, waitTime))

                // Use React Query mutation
                const clickScript = await generateClickSendScript(aiConfig as any)
                if (!clickScript) return { success: false, error: 'click_script_failed' }

                if (webview.isDestroyed?.() === true) return { success: false, error: 'webview_destroyed' }

                const clickResult = await webview.executeJavaScript(clickScript)
                if (!clickResult) return { success: false, error: 'autosend_failed_draft_saved' }

                return { success: true, mode: 'auto_click' }
            }

            return { success: true, mode: 'paste_only' }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_error'
            Logger.error('[useAiSender] Resim gönderme hatasý:', error)
            return { success: false, error: message }
        }
    }, [currentAI, autoSend, webviewRef, aiRegistry, getCachedConfig, activePromptText, queryClient, copyImageToClipboard, generateFocusScript, generateAutoSendScript, generateClickSendScript])

    return { sendTextToAI, sendImageToAI }
}

