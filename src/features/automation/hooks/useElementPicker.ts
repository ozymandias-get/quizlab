import { useCallback, useState, useRef, useEffect } from 'react'
import { Logger } from '@shared/lib/logger'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import { useToastActions } from '@app/providers/ToastContext'
import { useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGeneratePickerScript } from '@platform/electron/api/useAutomationApi'
import { canonicalizeHostname, normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { AiSelectorConfig } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'
import { usePickerPolling } from './usePickerPolling'
import { PICKER_SCRIPTS, PICKER_TRANSLATION_KEYS } from '../lib/automationConstants'
import { ensureErrorMessage } from '@shared/lib/errorUtils'

type WebviewInstance = WebviewController | null

interface UseElementPickerReturn {
  isPickerActive: boolean
  startPicker: () => Promise<void>
  stopPicker: () => Promise<void>
  togglePicker: () => Promise<void>
}

function isPickerConfig(value: unknown): value is AiSelectorConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AiSelectorConfig>
  return Boolean(candidate.inputFingerprint && candidate.buttonFingerprint)
}

/**
 * Hook to manage the Element Picker lifecycle and result processing.
 */
export function useElementPicker(
  getWebviewInstance: () => WebviewController | null | undefined
): UseElementPickerReturn {
  const [isPickerActive, setIsPickerActive] = useState<boolean>(false)
  const { showError, showInfo } = useToastActions()
  const { t } = useLanguageStrings()

  const pickerWebviewRef = useRef<WebviewInstance>(null)
  const isMountedRef = useRef(true)

  const { mutateAsync: saveAiConfig } = useSaveAiConfig()
  const { mutateAsync: generatePickerScript } = useGeneratePickerScript()

  const resetPickerArtifacts = useCallback(async (webview: WebviewInstance) => {
    try {
      if (webview && typeof webview.executeJavaScript === 'function') {
        await webview.executeJavaScript(PICKER_SCRIPTS.CLEANUP)
      }
    } catch (error) {
      Logger.warn('[ElementPicker] cleanup script failed', error)
    }
  }, [])

  const savePickerResult = useCallback(
    async (config: AiSelectorConfig) => {
      const webview = getWebviewInstance()
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
        const message = ensureErrorMessage(err, t('error_unknown_error'))
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
    [getWebviewInstance, resetPickerArtifacts, saveAiConfig, showError, t]
  )

  const { startPolling, stopPolling } = usePickerPolling({
    getWebviewInstance,
    mountedRef: isMountedRef,
    onResult: async (data) => {
      if (isPickerConfig(data)) {
        await savePickerResult(data)
      } else if (isMountedRef.current) {
        showError('picker_selection_missing')
        setIsPickerActive(false)
      }
    },
    onCancelled: () => {
      if (isMountedRef.current) {
        setIsPickerActive(false)
        showInfo('picker_cancelled')
      }
    },
    onError: (error) => {
      Logger.warn('[ElementPicker] Polling error:', error)
    }
  })

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopPolling()
      void resetPickerArtifacts(pickerWebviewRef.current)
    }
  }, [resetPickerArtifacts, stopPolling])

  useEffect(() => {
    const webview = getWebviewInstance() || null
    if (!isPickerActive) return
    if (pickerWebviewRef.current === webview) return

    stopPolling()
    void resetPickerArtifacts(pickerWebviewRef.current)
    pickerWebviewRef.current = webview
    setIsPickerActive(false)
  }, [isPickerActive, resetPickerArtifacts, stopPolling, getWebviewInstance])

  const startPicker = useCallback(async () => {
    const webview = getWebviewInstance()
    if (!webview) {
      showError('picker_webview_not_found')
      return
    }

    try {
      const pickerTranslations = Object.fromEntries(
        PICKER_TRANSLATION_KEYS.map((key) => [key, t(key)])
      ) as Record<string, string>

      const script = await generatePickerScript(pickerTranslations)
      if (!script) {
        throw new Error('Failed to generate picker script')
      }

      if (typeof webview.executeJavaScript !== 'function') {
        throw new Error('Webview executeJavaScript not available')
      }

      await resetPickerArtifacts(webview)
      await webview.executeJavaScript(PICKER_SCRIPTS.RESET)
      await webview.executeJavaScript(script)

      pickerWebviewRef.current = webview || null
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
    getWebviewInstance,
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
    const webview = pickerWebviewRef.current ?? getWebviewInstance()
    pickerWebviewRef.current = null
    if (!webview) {
      setIsPickerActive(false)
      return
    }

    try {
      if (typeof webview.executeJavaScript !== 'function') {
        throw new Error('Webview executeJavaScript not available')
      }

      await webview.executeJavaScript(PICKER_SCRIPTS.CLEANUP)
      setIsPickerActive(false)
      showInfo('picker_cancelled')
    } catch (err) {
      Logger.error('Failed to stop picker:', err)
      setIsPickerActive(false)
    }
  }, [getWebviewInstance, showInfo, stopPolling])

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
