import { useCallback, useRef, RefObject } from 'react'
import { Logger } from '../utils/logger'
import { safeWebviewPaste } from '../utils/webviewUtils'
import { usePrompts } from './usePrompts'
import type { WebviewController } from '../types/webview'

/**
 * useAiSender Hook
 * 
 * Core hook for the "Magic Selector" feature. Handles sending text and images to AI platforms.
 * 
 * This hook is the implementation of QuizLab's revolutionary AI integration system.
 * Instead of using expensive API keys, it automates interactions with AI websites by:
 * 
 * 1. **Text Injection**: Finds the input field using saved CSS selectors and injects text
 * 2. **Auto-Submit**: Optionally clicks the send button to submit the query
 * 3. **Image Pasting**: Copies images to clipboard and pastes them into the AI chat
 * 4. **Prompt Templates**: Prepends custom prompts (e.g., "Explain this:", "Summarize:")
 * 
 * **How It Works:**
 * 
 * Setup Phase (done once per AI website):
 * - User uses Magic Selector to click on input field → saves its CSS selector
 * - User clicks on send button → saves its CSS selector
 * - Configuration saved to local storage
 * 
 * Usage Phase:
 * - User selects text in PDF and clicks "Send to AI"
 * - This hook loads the saved selectors for the current AI site
 * - Generates JavaScript code to find those elements
 * - Executes the code in the webview using executeJavaScript()
 * - The AI website processes it as if the user typed it manually
 * 
 * **Key Features:**
 * 
 * - **Config Caching**: Avoids re-fetching selectors on every send
 * - **Custom Selectors**: Falls back to custom user-defined selectors if available
 * - **Prompt System**: Automatically prepends action-specific prompts
 * - **Domain Validation**: Ensures user is on the correct AI website before sending
 * - **Error Handling**: Graceful fallbacks for various failure scenarios
 * - **Image Support**: Handles screenshot-to-AI workflow via clipboard
 * 
 * @param webviewRef - Reference to the webview element containing the AI website
 * @param currentAI - ID of the currently active AI platform (e.g., "chatgpt", "claude")
 * @param autoSend - Whether to automatically click send after injecting text
 * @param aiRegistry - Registry of all AI platforms with their default configurations
 * 
 * @returns Object with sendTextToAI and sendImageToAI functions
 * 
 * @example
 * ```typescript
 * const { sendTextToAI, sendImageToAI } = useAiSender(
 *   webviewRef,
 *   "chatgpt",
 *   true, // auto-send enabled
 *   aiRegistry
 * );
 * 
 * // Send text
 * const result = await sendTextToAI("Explain quantum computing");
 * if (result.success) {
 *   console.log("Text sent successfully");
 * }
 * 
 * // Send image
 * const imageResult = await sendImageToAI(screenshotDataUrl);
 * if (imageResult.success) {
 *   console.log("Image sent successfully");
 * }
 * ```
 */

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

type ElectronAPI = Window['electronAPI']

const CLIPBOARD_WAIT_DELAY = 800

export function useAiSender(
    webviewRef: RefObject<WebviewController | null>, // Electron.WebviewTag replacement
    currentAI: string,
    autoSend: boolean,
    aiRegistry: Record<string, AiConfig> | null
): UseAiSenderReturn {
    // Modular prompt logic
    const { activePromptText } = usePrompts()

    // Cache to avoid re-fetching/calculating config for the same URL
    const configCache = useRef<ConfigCache>({ key: null, data: null })

    const getCachedConfig = useCallback(async (API: ElectronAPI, webview: WebviewController, baseConfig: AiConfig): Promise<CacheData> => { // Electron.WebviewTag replacement
        if (!API || !webview || typeof webview.getURL !== 'function') return { config: baseConfig, regex: null }

        const currentUrl = webview.getURL()
        if (!currentUrl) return { config: baseConfig, regex: null }
        const configSignature = JSON.stringify(baseConfig || {})
        const cacheKey = `${currentUrl}::${currentAI}::${configSignature}`

        if (configCache.current.key === cacheKey && configCache.current.data) {
            return configCache.current.data
        }

        try {
            const hostname = new URL(currentUrl).hostname
            const customConfig = await API.getAiConfig?.(hostname)
            const selectorConfig = (customConfig && typeof customConfig === 'object' && 'input' in customConfig)
                ? (customConfig as AiConfig)
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

        const API = window.electronAPI
        if (!API) return { success: false, error: 'api_unavailable' }

        try {
            // Get base config from registry
            let baseAiConfig = aiRegistry[currentAI]
            if (!baseAiConfig) return { success: false, error: 'config_not_found' }

            if (typeof webview.getURL !== 'function') {
                return { success: false, error: 'webview_api_missing' }
            }

            // Get config + regex (cached if possible)
            const { config: aiConfig, regex } = await getCachedConfig(API, webview, baseAiConfig)
            const currentUrl = webview.getURL() // Get again for logging/consistency check if needed
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

            const script = await API.automation.generateAutoSendScript(aiConfig, finalText, autoSend)
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
    }, [currentAI, autoSend, webviewRef, aiRegistry, getCachedConfig, activePromptText])

    const sendImageToAI = useCallback(async (imageDataUrl: string): Promise<SendImageResult> => {
        const webview = webviewRef.current
        if (!webview || !imageDataUrl) return { success: false, error: 'invalid_input' }
        if (!aiRegistry) return { success: false, error: 'registry_not_loaded' }

        // Sanity check for data URL
        if (!imageDataUrl.startsWith('data:image/')) {
            Logger.error('[useAiSender] Geçersiz resim formatı')
            return { success: false, error: 'invalid_image_format' }
        }

        const API = window.electronAPI
        if (!API) return { success: false, error: 'api_unavailable' }

        try {
            // Get base config from registry
            let baseAiConfig = aiRegistry[currentAI]
            if (!baseAiConfig) return { success: false, error: 'config_not_found' }

            // Get config (cached if possible) - regex check usually skipped for images or same as text
            const { config: aiConfig } = await getCachedConfig(API, webview, baseAiConfig)

            const copied = await API?.copyImageToClipboard(imageDataUrl)
            if (!copied) return { success: false, error: 'clipboard_failed' }

            // Focus webview
            try {
                if (webview.isDestroyed?.() !== true && typeof webview.focus === 'function') {
                    webview.focus()
                }
            } catch (e) { }

            await new Promise(r => setTimeout(r, 100))

            const focusScript = await API.automation.generateFocusScript(aiConfig)
            if (!focusScript) return { success: false, error: 'focus_script_failed' }

            if (webview.isDestroyed?.() === true) return { success: false, error: 'webview_destroyed' }
            const focused = await webview.executeJavaScript(focusScript)
            if (!focused) return { success: false, error: 'focus_failed' }

            // Wait for clipboard to be ready in the remote process
            await new Promise(r => setTimeout(r, CLIPBOARD_WAIT_DELAY))

            let pasteSuccess = false

            // Try native paste if available (Electron 22+)
            // Note: pasteNative is not a standard method on webview tag in Electron types?
            // checking if it exists on the instance dynamically
            if (webview.isDestroyed?.() !== true) {
                if (webview.pasteNative && typeof webview.getWebContentsId === 'function') {
                    try {
                        const wcId = webview.getWebContentsId()
                        if (wcId) {
                            const result = webview.pasteNative(wcId)
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
                const promptScript = await API.automation.generateAutoSendScript(aiConfig, activePromptText, autoSend)

                if (promptScript) {
                    if (webview.isDestroyed?.() === true) return { success: false, error: 'webview_destroyed' }
                    await webview.executeJavaScript(promptScript)
                    return { success: true, mode: autoSend ? 'auto_click_with_prompt' : 'paste_and_prompt' }
                }
            }

            if (autoSend) {
                // Wait for image to upload/process in the AI interface
                let waitTime = aiConfig.imageWaitTime || 1000
                await new Promise(r => setTimeout(r, waitTime))

                const clickScript = await API.automation.generateClickSendScript(aiConfig)
                if (!clickScript) return { success: false, error: 'click_script_failed' }

                if (webview.isDestroyed?.() === true) return { success: false, error: 'webview_destroyed' }

                const clickResult = await webview.executeJavaScript(clickScript)
                if (!clickResult) return { success: false, error: 'autosend_failed_draft_saved' }

                return { success: true, mode: 'auto_click' }
            }

            return { success: true, mode: 'paste_only' }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_error'
            Logger.error('[useAiSender] Resim gönderme hatası:', error)
            return { success: false, error: message }
        }
    }, [currentAI, autoSend, webviewRef, aiRegistry, getCachedConfig, activePromptText])

    return { sendTextToAI, sendImageToAI }
}
