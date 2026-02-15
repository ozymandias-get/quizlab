import { useCallback, useState, useRef, useEffect } from 'react'
import { Logger } from '@src/utils/logger'
import { useToast, useLanguage } from '@src/app/providers'
import type { WebviewController } from '@shared/types/webview';

type WebviewInstance = WebviewController | null;

interface UseElementPickerReturn {
    isPickerActive: boolean;
    startPicker: () => Promise<void>;
    stopPicker: () => Promise<void>;
    togglePicker: () => Promise<void>;
}

const POLL_INTERVAL = 500 // ms

/**
 * Element Picker Logic as a Hook
 * Uses polling to check for picker results instead of console-message events
 */
export function useElementPicker(webviewInstance: WebviewInstance): UseElementPickerReturn {
    const [isPickerActive, setIsPickerActive] = useState<boolean>(false)
    const { showSuccess, showError, showInfo } = useToast()
    const { t } = useLanguage()
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
            }
        }
    }, [])

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
        }
    }, [])

    const savePickerResult = useCallback(async (config: { input: string; button: string }) => {
        const webview = webviewInstance
        if (!webview) return

        try {
            // Force cleanup webview picker UI
            try {
                if (typeof webview.executeJavaScript === 'function') {
                    await webview.executeJavaScript('if (window._aiPickerCleanup) window._aiPickerCleanup(); delete window._aiPickerResult; delete window._aiPickerCancelled;')
                }
            } catch (_) { }

            if (typeof webview.getURL !== 'function') {
                showError('picker_webview_not_found')
                return
            }
            const url = webview.getURL()
            if (!url) {
                showError('picker_webview_not_found')
                return
            }
            const hostname = new URL(url).hostname

            if (!window.electronAPI?.saveAiConfig) {
                Logger.error('Electron API not available')
                return
            }
            const saved = await window.electronAPI.saveAiConfig(hostname, config)

            if (saved) {
                showSuccess('sent_successfully')
            } else {
                showError('picker_save_failed')
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : t('error_unknown_error')
            Logger.error('[ElementPicker] Save error:', err)
            showError('toast_pdf_load_error', undefined, { error: message })
        } finally {
            setIsPickerActive(false)
        }
    }, [webviewInstance, showSuccess, showError, t])

    const startPolling = useCallback(() => {
        stopPolling()

        pollRef.current = setInterval(async () => {
            const webview = webviewInstance
            if (!webview || typeof webview.executeJavaScript !== 'function') return

            try {
                // Check for result or cancellation
                const status = await webview.executeJavaScript(`
                    (function() {
                        if (window._aiPickerResult) {
                            var r = JSON.stringify(window._aiPickerResult);
                            return JSON.stringify({ type: 'result', data: r });
                        }
                        if (window._aiPickerCancelled) {
                            delete window._aiPickerCancelled;
                            return JSON.stringify({ type: 'cancelled' });
                        }
                        return null;
                    })()
                `)

                if (!status) return

                const parsed = typeof status === 'string' ? JSON.parse(status) : status

                if (parsed.type === 'cancelled') {
                    stopPolling()
                    setIsPickerActive(false)
                    showInfo('picker_cancelled')
                    return
                }

                if (parsed.type === 'result') {
                    stopPolling()
                    const config = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data

                    if (config && config.input && config.button) {
                        await savePickerResult(config)
                    } else {
                        showError('picker_selection_missing')
                        setIsPickerActive(false)
                    }
                }
            } catch (_) {
                // Polling errors are non-critical (webview might be navigating)
            }
        }, POLL_INTERVAL)
    }, [webviewInstance, stopPolling, savePickerResult, showError, showInfo])

    const startPicker = useCallback(async () => {
        if (!webviewInstance) {
            showError('picker_webview_not_found')
            return
        }

        try {
            const pickerTranslations = {
                picker_step: t('picker_step'),
                picker_done_btn: t('picker_done_btn'),
                picker_intro_title: t('picker_intro_title'),
                picker_intro_text: t('picker_intro_text'),
                picker_typing_title: t('picker_typing_title'),
                picker_typing_text: t('picker_typing_text'),
                picker_submit_title: t('picker_submit_title'),
                picker_submit_text: t('picker_submit_text'),
                picker_completed: t('picker_completed'),
                picker_saving: t('picker_saving'),
                picker_good_choice: t('picker_good_choice'),
                picker_maybe: t('picker_maybe'),
                picker_wrong: t('picker_wrong'),
                picker_hint_input_correct: t('picker_hint_input_correct'),
                picker_hint_submit_correct: t('picker_hint_submit_correct'),
                picker_hint_button_send: t('picker_hint_button_send'),
                picker_hint_div_input: t('picker_hint_div_input'),
                picker_hint_textarea_perfect: t('picker_hint_textarea_perfect'),
                picker_hint_generic_box: t('picker_hint_generic_box'),
                picker_hint_icon: t('picker_hint_icon'),
                picker_hint_text: t('picker_hint_text'),
                picker_hint_form: t('picker_hint_form'),
                picker_hint_clickable: t('picker_hint_clickable'),
                // Element Labels
                picker_el_input: t('picker_el_input'),
                picker_el_submit: t('picker_el_submit'),
                picker_el_input_field: t('picker_el_input_field'),
                picker_el_msg_box: t('picker_el_msg_box'),
                picker_el_button: t('picker_el_button'),
                picker_el_msg_area: t('picker_el_msg_area'),
                picker_el_clickable: t('picker_el_clickable'),
                picker_el_container: t('picker_el_container'),
                picker_el_icon: t('picker_el_icon'),
                picker_el_link: t('picker_el_link'),
                picker_el_text: t('picker_el_text'),
                picker_el_form: t('picker_el_form')
            }
            if (!window.electronAPI?.automation?.generatePickerScript) {
                throw new Error('Electron API automation not available')
            }
            const script = await window.electronAPI.automation.generatePickerScript(pickerTranslations)
            if (!script) {
                throw new Error('Failed to generate picker script')
            }
            if (typeof webviewInstance.executeJavaScript !== 'function') {
                throw new Error('Webview executeJavaScript not available')
            }

            // Clear any previous result before starting
            await webviewInstance.executeJavaScript('delete window._aiPickerResult; delete window._aiPickerCancelled;')

            await webviewInstance.executeJavaScript(script)
            setIsPickerActive(true)
            showInfo('picker_started_hint')

            // Start polling for result
            startPolling()
        } catch (err) {
            Logger.error('Failed to start picker:', err)
            showError('picker_init_failed')
            setIsPickerActive(false)
            stopPolling()
        }
    }, [webviewInstance, showError, showInfo, t, startPolling, stopPolling])

    const stopPicker = useCallback(async () => {
        stopPolling()
        if (!webviewInstance) return
        try {
            if (typeof webviewInstance.executeJavaScript !== 'function') {
                throw new Error('Webview executeJavaScript not available')
            }
            await webviewInstance.executeJavaScript('if (window._aiPickerCleanup) window._aiPickerCleanup(); delete window._aiPickerResult; delete window._aiPickerCancelled;')
            setIsPickerActive(false)
            showInfo('picker_cancelled')
        } catch (err) {
            Logger.error('Failed to stop picker:', err)
            setIsPickerActive(false)
        }
    }, [webviewInstance, showInfo, stopPolling])

    const togglePicker = useCallback(async () => {
        if (isPickerActive) {
            await stopPicker()
        } else {
            await startPicker()
        }
    }, [isPickerActive, startPicker, stopPicker])

    return {
        isPickerActive,
        startPicker,
        stopPicker,
        togglePicker
    }
}
