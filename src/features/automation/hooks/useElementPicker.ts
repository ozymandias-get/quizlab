import { useCallback, useState, useRef, useEffect } from 'react'
import { Logger } from '@shared/lib/logger'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import { useToastActions } from '@app/providers/ToastContext'
import { useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGeneratePickerScript } from '@platform/electron/api/useAutomationApi'
import { canonicalizeHostname, normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { AiSelectorConfig } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

type WebviewInstance = WebviewController | null

interface UseElementPickerReturn {
  isPickerActive: boolean
  startPicker: () => Promise<void>
  stopPicker: () => Promise<void>
  togglePicker: () => Promise<void>
}

const POLL_INTERVAL = 500
const PICKER_RESET_SCRIPT = 'delete window._aiPickerResult; delete window._aiPickerCancelled;'
const PICKER_CLEANUP_SCRIPT =
  'if (window._aiPickerCleanup) window._aiPickerCleanup(); delete window._aiPickerResult; delete window._aiPickerCancelled;'
const PICKER_STATUS_SCRIPT = `
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
`

export function useElementPicker(webviewInstance: WebviewInstance): UseElementPickerReturn {
  const [isPickerActive, setIsPickerActive] = useState<boolean>(false)
  const { showError, showInfo } = useToastActions()
  const { t } = useLanguageStrings()
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollInFlightRef = useRef(false)
  const pollSessionRef = useRef(0)
  const pickerWebviewRef = useRef<WebviewInstance>(null)
  const isMountedRef = useRef(true)

  const { mutateAsync: saveAiConfig } = useSaveAiConfig()
  const { mutateAsync: generatePickerScript } = useGeneratePickerScript()

  const resetPickerArtifacts = useCallback(async (webview: WebviewInstance) => {
    try {
      if (webview && typeof webview.executeJavaScript === 'function') {
        await webview.executeJavaScript(PICKER_CLEANUP_SCRIPT)
      }
    } catch (error) {
      Logger.warn('[ElementPicker] cleanup script failed', error)
    }
  }, [])

  const stopPolling = useCallback(() => {
    pollSessionRef.current += 1
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
    pollInFlightRef.current = false
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopPolling()
      void resetPickerArtifacts(pickerWebviewRef.current)
    }
  }, [resetPickerArtifacts, stopPolling])

  useEffect(() => {
    if (!isPickerActive) return
    if (pickerWebviewRef.current === webviewInstance) return

    stopPolling()
    void resetPickerArtifacts(pickerWebviewRef.current)
    pickerWebviewRef.current = webviewInstance
    setIsPickerActive(false)
  }, [isPickerActive, resetPickerArtifacts, stopPolling, webviewInstance])

  const savePickerResult = useCallback(
    async (config: AiSelectorConfig) => {
      const webview = webviewInstance
      if (!webview) return

      try {
        await resetPickerArtifacts(webview)

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
        const normalizedHostname = hostname.toLowerCase()
        await saveAiConfig({
          hostname: normalizedHostname,
          config: {
            ...config,
            version: 2,
            sourceUrl: url,
            sourceHostname: normalizedHostname,
            canonicalHostname: canonicalizeHostname(normalizedHostname) || normalizedHostname,
            submitMode: normalizeSubmitMode(config.submitMode) || 'mixed',
            health: 'ready'
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : t('error_unknown_error')
        Logger.error('[ElementPicker] Save error:', err)
        if (isMountedRef.current) {
          showError('toast_pdf_load_error', undefined, { error: message })
        }
      } finally {
        if (isMountedRef.current) {
          setIsPickerActive(false)
        }
      }
    },
    [webviewInstance, resetPickerArtifacts, saveAiConfig, showError, t]
  )

  const startPolling = useCallback(() => {
    stopPolling()
    const sessionId = pollSessionRef.current

    const scheduleNextPoll = () => {
      if (!isMountedRef.current || pollSessionRef.current !== sessionId) {
        return
      }
      pollTimeoutRef.current = setTimeout(() => {
        pollTimeoutRef.current = null
        void pollOnce()
      }, POLL_INTERVAL)
    }

    const pollOnce = async () => {
      if (pollSessionRef.current !== sessionId || pollInFlightRef.current) {
        return
      }

      const webview = webviewInstance
      if (!webview || typeof webview.executeJavaScript !== 'function') {
        scheduleNextPoll()
        return
      }

      pollInFlightRef.current = true
      try {
        const status = await webview.executeJavaScript(PICKER_STATUS_SCRIPT)
        if (pollSessionRef.current !== sessionId) {
          return
        }
        if (!status) {
          scheduleNextPoll()
          return
        }

        const parsed = typeof status === 'string' ? JSON.parse(status) : status

        if (parsed.type === 'cancelled') {
          stopPolling()
          if (isMountedRef.current) {
            setIsPickerActive(false)
            showInfo('picker_cancelled')
          }
          return
        }

        if (parsed.type === 'result') {
          stopPolling()
          const config = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data

          if (config && config.inputFingerprint && config.buttonFingerprint) {
            await savePickerResult(config)
          } else if (isMountedRef.current) {
            showError('picker_selection_missing')
            setIsPickerActive(false)
          }
          return
        }

        scheduleNextPoll()
      } catch (error) {
        Logger.warn('[ElementPicker] polling failed', error)
        scheduleNextPoll()
      } finally {
        if (pollSessionRef.current === sessionId) {
          pollInFlightRef.current = false
        }
      }
    }

    scheduleNextPoll()
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

      const script = await generatePickerScript(pickerTranslations)
      if (!script) {
        throw new Error('Failed to generate picker script')
      }

      if (typeof webviewInstance.executeJavaScript !== 'function') {
        throw new Error('Webview executeJavaScript not available')
      }

      await resetPickerArtifacts(webviewInstance)
      await webviewInstance.executeJavaScript(PICKER_RESET_SCRIPT)
      await webviewInstance.executeJavaScript(script)

      pickerWebviewRef.current = webviewInstance
      setIsPickerActive(true)
      showInfo('picker_started_hint')
      startPolling()
    } catch (err) {
      Logger.error('Failed to start picker:', err)
      showError('picker_init_failed')
      setIsPickerActive(false)
      stopPolling()
    }
  }, [
    webviewInstance,
    showError,
    showInfo,
    t,
    startPolling,
    stopPolling,
    generatePickerScript,
    resetPickerArtifacts
  ])

  const stopPicker = useCallback(async () => {
    stopPolling()
    pickerWebviewRef.current = null
    if (!webviewInstance) {
      setIsPickerActive(false)
      return
    }

    try {
      if (typeof webviewInstance.executeJavaScript !== 'function') {
        throw new Error('Webview executeJavaScript not available')
      }

      await webviewInstance.executeJavaScript(PICKER_CLEANUP_SCRIPT)
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
