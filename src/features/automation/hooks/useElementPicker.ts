import { canonicalizeHostname, normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { AiSelectorConfig } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGeneratePickerScript } from '@platform/electron/api/useAutomationApi'

import { enqueueSelectorRepair } from '@features/ai'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PICKER_SCRIPTS, PICKER_TRANSLATION_KEYS } from '../lib/automationConstants'
import type { UseElementPickerReturn } from './elementPickerUtils'
import { isPickerConfig, resetPickerArtifacts } from './elementPickerUtils'
import { usePickerConsoleBridge } from './usePickerConsoleBridge'

/**
 * Hook to manage the Element Picker lifecycle and result processing.
 */
export function useElementPicker(
  getContentController: () => AiContentController | null | undefined
): UseElementPickerReturn {
  const [isPickerActive, setIsPickerActive] = useState<boolean>(false)
  const { showError, showInfo } = useToastActions()
  const { t } = useTranslation()

  const isMountedRef = useRef(true)

  // Re-entrance guard: a double-click on the trigger (or a second toggle
  // call before the first settled) used to inject two scripts into the same
  // content, which left the first script's listeners orphaned once the
  // second one's cleanup ran. Block re-entry until the in-flight start
  // resolves.
  const startInFlightRef = useRef(false)
  const activePickerContentRef = useRef<AiContentController | null>(null)
  // Binds a picker run to the result it produces: the session id travels
  // into the injected script and back through the console bridge, so a
  // delayed emit from an older run can never be saved as the new run's
  // result. The start URL snapshots where the pick began: if the view
  // navigated mid-pick, the stale selectors must not be saved onto the new
  // hostname.
  const pickerSessionRef = useRef<string | null>(null)
  const pickerStartUrlRef = useRef<string | null>(null)

  function createPickerSessionId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }

  function readContentUrl(content: AiContentController | null | undefined): string | null {
    try {
      if (content && typeof content.getURL === 'function') {
        const url = content.getURL()
        return typeof url === 'string' && url ? url : null
      }
    } catch {
      // getURL may throw for a destroyed view; treat as unknown.
    }
    return null
  }

  // Stabilize the content getter so consumers passing an inline arrow
  // function don't churn the mount effect's identity on every render.
  const getContentRef = useRef(getContentController)
  useEffect(() => {
    getContentRef.current = getContentController
  }, [getContentController])

  // Suppress the default `toast_ai_config_save_failed` toast — the picker
  // surfaces a domain-specific `picker_save_failed` (with the underlying
  // error message) so showing both would be a double-toast UX bug.
  const { mutateAsync: saveAiConfig } = useSaveAiConfig({ suppressErrorToast: true })
  const { mutateAsync: generatePickerScript } = useGeneratePickerScript()

  const savePickerResult = useCallback(
    async (config: AiSelectorConfig, sourceContent: AiContentController | null) => {
      if (!sourceContent || getContentRef.current() !== sourceContent) {
        Logger.info('[Picker] savePickerResult: source content is no longer active')
        return
      }

      Logger.info('[Picker] savePickerResult: config received', {
        inputFingerprint: config.inputFingerprint,
        buttonFingerprint: config.buttonFingerprint,
        submitMode: config.submitMode
      })
      const content = sourceContent
      if (getContentRef.current() !== content) {
        Logger.info('[Picker] savePickerResult: source content changed, aborting')
        return
      }

      // The view may have navigated between the pick and the save (same
      // webview, in-page navigation keeps the controller identity). Saving
      // the old site's selectors onto the new hostname would silently aim
      // future automation at the wrong site.
      try {
        const startUrl = pickerStartUrlRef.current
        const currentUrl = readContentUrl(content)
        if (startUrl && currentUrl) {
          const startHost = new URL(startUrl).hostname.toLowerCase()
          const currentHost = new URL(currentUrl).hostname.toLowerCase()
          if (startHost && currentHost && startHost !== currentHost) {
            Logger.info(
              `[Picker] savePickerResult: hostname changed during pick (${startHost} -> ${currentHost}), aborting`
            )
            showError('picker_selection_missing')
            return
          }
        }
      } catch {
        // URL parsing must never block a save; the hostname save below still
        // derives from the current URL.
      }

      try {
        await resetPickerArtifacts(content)

        if (typeof content.getURL !== 'function') {
          Logger.info('[Picker] savePickerResult: content.getURL missing')
          showError('picker_webview_not_found')
          return
        }

        const url = content.getURL()
        Logger.info(`[Picker] savePickerResult: url=${url}`)
        if (!url) {
          Logger.info('[Picker] savePickerResult: empty url')
          showError('picker_webview_not_found')
          return
        }

        const normalizedHostname = new URL(url).hostname.toLowerCase()
        // A manual pick is a new baseline: staged self-healing state from the
        // previous locators must not survive (it would otherwise keep a dead
        // recovery alive and let stale evidence advance it). `lastRepair`
        // history is kept: it only ever blocks a *future* different promotion
        // and can never rewrite the just-picked primaries.
        // The save joins the per-host repair queue so it is totally ordered
        // with in-flight self-healing writes: a repair queued before the pick
        // persists first and the full manual config wins; a repair queued
        // after re-reads the picked config and its staleness check drops the
        // outdated evidence instead of overwriting the manual selection.
        await enqueueSelectorRepair(normalizedHostname, () =>
          saveAiConfig({
            hostname: normalizedHostname,
            config: {
              ...config,
              version: 2,
              sourceUrl: url,
              sourceHostname: normalizedHostname,
              canonicalHostname: canonicalizeHostname(normalizedHostname) || normalizedHostname,
              submitMode: normalizeSubmitMode(config.submitMode) || 'mixed',
              health: 'ready',
              repair: null
            }
          })
        )
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
          activePickerContentRef.current = null
          pickerSessionRef.current = null
          pickerStartUrlRef.current = null
          setIsPickerActive(false)
        }
      }
    },
    [saveAiConfig, showError, t]
  )

  const { startListening, stopListening } = usePickerConsoleBridge({
    getContentController: () => getContentRef.current(),
    mountedRef: isMountedRef,
    onResult: async (data, resultSessionId) => {
      Logger.info('[Picker] bridge onResult:', data)
      // Defense in depth: the bridge already matched the session, but a
      // mismatched session here means a stale run is being saved — drop it.
      const activeSession = pickerSessionRef.current
      if (activeSession && resultSessionId && resultSessionId !== activeSession) {
        Logger.info('[Picker] bridge onResult: stale session result ignored')
        return
      }
      if (isPickerConfig(data)) {
        await savePickerResult(data, activePickerContentRef.current)
      } else if (isMountedRef.current) {
        Logger.info('[Picker] bridge onResult: !isPickerConfig, showing picker_selection_missing')
        showError('picker_selection_missing')
        activePickerContentRef.current = null
        setIsPickerActive(false)
      }
    },
    onCancelled: () => {
      Logger.info('[Picker] bridge onCancelled: user pressed ESC')
      if (isMountedRef.current) {
        activePickerContentRef.current = null
        pickerSessionRef.current = null
        pickerStartUrlRef.current = null
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
      void resetPickerArtifacts(activePickerContentRef.current ?? getContentRef.current() ?? null)
      activePickerContentRef.current = null
      pickerSessionRef.current = null
      pickerStartUrlRef.current = null
    }
  }, [stopListening])

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
      const content = getContentRef.current()
      if (!content) {
        Logger.info('[Picker] startPicker: no content')
        showError('picker_webview_not_found')
        return
      }

      const sessionId = createPickerSessionId()
      const script = await generatePickerScript({ translations: pickerTranslations, sessionId })
      if (getContentRef.current() !== content || content.isDestroyed?.() === true) {
        Logger.info('[Picker] startPicker: source content changed, aborting')
        return
      }
      Logger.info(`[Picker] startPicker: script generated, length=${script?.length ?? 0}`)
      if (!script) {
        throw new Error('Failed to generate picker script')
      }

      if (typeof content.executeJavaScript !== 'function') {
        throw new Error('content executeJavaScript not available')
      }

      await resetPickerArtifacts(content)
      await content.executeJavaScript(PICKER_SCRIPTS.RESET)
      await content.executeJavaScript(script)
      if (getContentRef.current() !== content || content.isDestroyed?.() === true) {
        await resetPickerArtifacts(content)
        return
      }
      activePickerContentRef.current = content
      pickerSessionRef.current = sessionId
      pickerStartUrlRef.current = readContentUrl(content)
      Logger.info('[Picker] startPicker: script injected into content, setting isPickerActive=true')

      setIsPickerActive(true)
      showInfo('picker_started_hint')
      startListening(content, sessionId)
    } catch (err) {
      Logger.error('[Picker] startPicker: error', err)
      showError('picker_init_failed')
      activePickerContentRef.current = null
      setIsPickerActive(false)
      stopListening()
    } finally {
      startInFlightRef.current = false
    }
  }, [pickerTranslations, showError, showInfo, startListening, stopListening, generatePickerScript])

  const stopPicker = useCallback(async () => {
    stopListening()
    const content = activePickerContentRef.current ?? getContentRef.current()
    activePickerContentRef.current = null
    pickerSessionRef.current = null
    pickerStartUrlRef.current = null
    if (!content) {
      setIsPickerActive(false)
      return
    }

    try {
      if (typeof content.executeJavaScript !== 'function') {
        throw new Error('content executeJavaScript not available')
      }

      await content.executeJavaScript(PICKER_SCRIPTS.CLEANUP)
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
