import { canonicalizeHostname, normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { AiSelectorConfig } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import { useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGeneratePickerScript } from '@platform/electron/api/useAutomationApi'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PICKER_SCRIPTS, PICKER_TRANSLATION_KEYS } from '../lib/automationConstants'
import { usePickerConsoleBridge } from './usePickerConsoleBridge'

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
  const { t } = useTranslation()

  const isMountedRef = useRef(true)

  // Re-entrance guard: a double-click on the trigger (or a second toggle
  // call before the first settled) used to inject two scripts into the same
  // webview, which left the first script's listeners orphaned once the
  // second one's cleanup ran. Block re-entry until the in-flight start
  // resolves.
  const startInFlightRef = useRef(false)

  // Stabilize the webview getter so consumers passing an inline arrow
  // function don't churn the mount effect's identity on every render.
  const getWebviewRef = useRef(getWebviewInstance)
  useEffect(() => {
    getWebviewRef.current = getWebviewInstance
  }, [getWebviewInstance])

  // Suppress the default `toast_ai_config_save_failed` toast — the picker
  // surfaces a domain-specific `picker_save_failed` (with the underlying
  // error message) so showing both would be a double-toast UX bug.
  const { mutateAsync: saveAiConfig } = useSaveAiConfig({ suppressErrorToast: true })
  const { mutateAsync: generatePickerScript } = useGeneratePickerScript()

  const resetPickerArtifacts = useCallback(async (webview: WebviewController | null) => {
    if (!webview || typeof webview.executeJavaScript !== 'function') {
      return
    }
    try {
      await webview.executeJavaScript(PICKER_SCRIPTS.CLEANUP)
    } catch (error) {
      Logger.warn('[ElementPicker] cleanup script failed', error)
    }
  }, [])

  const savePickerResult = useCallback(
    async (config: AiSelectorConfig) => {
      Logger.info('[Picker] savePickerResult: config received', {
        inputFingerprint: config.inputFingerprint,
        buttonFingerprint: config.buttonFingerprint,
        submitMode: config.submitMode
      })
      const webview = getWebviewRef.current()
      if (!webview) {
        Logger.info('[Picker] savePickerResult: no webview, aborting')
        return
      }

      try {
        await resetPickerArtifacts(webview)

        if (typeof webview.getURL !== 'function') {
          Logger.info('[Picker] savePickerResult: webview.getURL missing')
          showError('picker_webview_not_found')
          return
        }

        const url = webview.getURL()
        Logger.info(`[Picker] savePickerResult: url=${url}`)
        if (!url) {
          Logger.info('[Picker] savePickerResult: empty url')
          showError('picker_webview_not_found')
          return
        }

        const normalizedHostname = new URL(url).hostname.toLowerCase()
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
        Logger.info(`[Picker] savePickerResult: saved for ${normalizedHostname}`)
      } catch (err) {
        const message = ensureErrorMessage(err, t('error_unknown_error'))
        Logger.info('[Picker] savePickerResult: error', err)
        Logger.error('[ElementPicker] Save error:', err)
        if (isMountedRef.current) {
          showError('picker_save_failed', undefined, { error: message })
        }
      } finally {
        if (isMountedRef.current) {
          setIsPickerActive(false)
        }
      }
    },
    [resetPickerArtifacts, saveAiConfig, showError, t]
  )

  const { startListening, stopListening } = usePickerConsoleBridge({
    getWebviewInstance: () => getWebviewRef.current(),
    mountedRef: isMountedRef,
    onResult: async (data) => {
      Logger.info('[Picker] bridge onResult:', data)
      if (isPickerConfig(data)) {
        await savePickerResult(data)
      } else if (isMountedRef.current) {
        Logger.info('[Picker] bridge onResult: !isPickerConfig, showing picker_selection_missing')
        showError('picker_selection_missing')
        setIsPickerActive(false)
      }
    },
    onCancelled: () => {
      Logger.info('[Picker] bridge onCancelled: user pressed ESC')
      if (isMountedRef.current) {
        setIsPickerActive(false)
        // User explicitly pressed Escape — confirm the dismissal with a
        // toast so the click that toggled the picker off feels acknowledged.
        showInfo('picker_cancelled')
      }
    },
    onError: (error) => {
      Logger.info('[Picker] bridge onError:', error)
      Logger.warn('[ElementPicker] Bridge error:', error)
      showError('picker_init_failed')
    }
  })

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopListening()
      void resetPickerArtifacts(getWebviewRef.current() ?? null)
    }
  }, [resetPickerArtifacts, stopListening])

  // Memoize the translation map. `PICKER_TRANSLATION_KEYS` is static; we only
  // re-translate when `t` itself changes (i.e. on language switch). Without
  // this, every render would build a new object identity.
  const pickerTranslations = useMemo(() => {
    const map: Record<string, string> = {}
    for (const key of PICKER_TRANSLATION_KEYS) {
      map[key] = t(key)
    }
    return map
  }, [t])

  const startPicker = useCallback(async () => {
    if (startInFlightRef.current) {
      Logger.info('[Picker] startPicker ignored: already in flight')
      return
    }
    startInFlightRef.current = true
    Logger.info('[Picker] startPicker: entering')

    try {
      const webview = getWebviewRef.current()
      if (!webview) {
        Logger.info('[Picker] startPicker: no webview')
        showError('picker_webview_not_found')
        return
      }

      const script = await generatePickerScript(pickerTranslations)
      Logger.info(`[Picker] startPicker: script generated, length=${script?.length ?? 0}`)
      if (!script) {
        throw new Error('Failed to generate picker script')
      }

      if (typeof webview.executeJavaScript !== 'function') {
        throw new Error('Webview executeJavaScript not available')
      }

      await resetPickerArtifacts(webview)
      await webview.executeJavaScript(PICKER_SCRIPTS.RESET)
      await webview.executeJavaScript(script)
      Logger.info('[Picker] startPicker: script injected into webview, setting isPickerActive=true')

      setIsPickerActive(true)
      showInfo('picker_started_hint')
      startListening()
    } catch (err) {
      Logger.error('[Picker] startPicker: error', err)
      showError('picker_init_failed')
      setIsPickerActive(false)
      stopListening()
    } finally {
      startInFlightRef.current = false
    }
  }, [
    pickerTranslations,
    showError,
    showInfo,
    startListening,
    stopListening,
    generatePickerScript,
    resetPickerArtifacts
  ])

  const stopPicker = useCallback(async () => {
    stopListening()
    const webview = getWebviewRef.current()
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
  }, [showInfo, stopListening])

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
