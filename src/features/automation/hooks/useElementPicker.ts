import { canonicalizeHostname, normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { AiSelectorConfig } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGeneratePickerScript } from '@platform/electron/api/useAutomationApi'

import { enqueueSelectorRepair, invalidateAllConfigCaches } from '@features/ai'

import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { Logger } from '@shared/lib/logger'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PICKER_SCRIPTS, PICKER_TRANSLATION_KEYS } from '../lib/automationConstants'
import type { UseElementPickerReturn } from './elementPickerUtils'
import { isPickerConfig, resetPickerArtifacts, runWithTimeout } from './elementPickerUtils'
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

  /**
   * Single teardown point for the renderer-side picker state.
   *
   * `session` scopes the reset to one run: the `finally` of an in-flight save
   * must not deactivate a picker the user started in the meantime. Passing
   * nothing clears unconditionally.
   */
  const clearPickerState = useCallback((session?: string | null) => {
    if (session !== undefined && pickerSessionRef.current !== session) return
    activePickerContentRef.current = null
    pickerSessionRef.current = null
    pickerStartUrlRef.current = null
    setIsPickerActive(false)
  }, [])

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

  /**
   * Hostname of a page URL, or null when it has none (`about:blank`, `data:`,
   * `blob:`) or cannot be parsed. Callers must treat null as "origin
   * unverified" instead of letting `new URL` throw into the save path.
   */
  function readHostname(url: string | null | undefined): string | null {
    if (!url) return null
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      return hostname || null
    } catch {
      return null
    }
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
      const resultSession = pickerSessionRef.current
      // The teardown lives in `finally` so EVERY exit path deactivates the
      // picker. Previously the "no source content" guard returned before the
      // try/finally, leaving `isPickerActive` true forever with no listening
      // session behind it (the toggle stayed on and the next click re-armed).
      try {
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

        // The view may have navigated between the pick and the save (same
        // webview, in-page navigation keeps the controller identity). Saving
        // the old site's selectors onto the new hostname would silently aim
        // future automation at the wrong site.
        const startUrl = pickerStartUrlRef.current
        const currentUrl = readContentUrl(content)
        const startHost = readHostname(startUrl)
        const currentHost = readHostname(currentUrl)
        // The origin is only known if it was captured before injection. When
        // the start snapshot is missing (or unparseable) we cannot prove the
        // view did not navigate mid-pick, and the whole point of this guard is
        // to never aim one site's selectors at another. Fail safe instead of
        // skipping the check.
        if (currentHost && !startHost) {
          Logger.info('[Picker] savePickerResult: pick origin was never captured, aborting')
          // This is NOT a missing selection: the pick itself was fine, but the
          // page address could not be verified, so saving would risk writing
          // the selectors onto the wrong hostname. Say that instead of the
          // misleading "selection missing" so the user knows to reopen the
          // site rather than re-pick the same elements.
          showError('picker_origin_unverified')
          return
        }
        if (startHost && currentHost && startHost !== currentHost) {
          Logger.info(
            `[Picker] savePickerResult: hostname changed during pick (${startHost} -> ${currentHost}), aborting`
          )
          showError('picker_selection_missing')
          return
        }
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

        // A privileged page URL (`about:blank`, `data:`, `blob:`, a malformed
        // string) has no hostname to key the config by. Parsing it was the
        // last unguarded `new URL` in this path: a throw became a generic
        // `picker_save_failed`, and an empty hostname reached the save IPC,
        // which rejects it while the UI still shows a success toast.
        const normalizedHostname = readHostname(url)
        if (!normalizedHostname) {
          Logger.info('[Picker] savePickerResult: current url has no hostname, aborting')
          showError('picker_origin_unverified')
          return
        }
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
        invalidateAllConfigCaches()
        Logger.info(`[Picker] savePickerResult: saved for ${normalizedHostname}`)
      } catch (err) {
        const message = ensureErrorMessage(err, t('error_unknown_error'))
        Logger.info('[Picker] savePickerResult: error', err)
        Logger.error('[ElementPicker] Save error:', err)
        if (isMountedRef.current) {
          showError('picker_save_failed', undefined, { error: message })
        }
      } finally {
        if (isMountedRef.current) clearPickerState(resultSession)
      }
    },
    [clearPickerState, saveAiConfig, showError, t]
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
      const content = activePickerContentRef.current
      if (!content) {
        // The bridge stops listening on this path too, so nothing else will
        // clear the flag: a result without a target view would otherwise leave
        // the toggle stuck "active".
        Logger.info('[Picker] bridge onResult: no active picker content, dropping result')
        if (isMountedRef.current) {
          clearPickerState()
          showError('picker_selection_missing')
        }
        return
      }
      if (isPickerConfig(data)) {
        await savePickerResult(data, content)
      } else if (isMountedRef.current) {
        Logger.info('[Picker] bridge onResult: !isPickerConfig, showing picker_selection_missing')
        showError('picker_selection_missing')
        clearPickerState()
      }
    },
    onCancelled: () => {
      Logger.info('[Picker] bridge onCancelled: user pressed ESC')
      if (isMountedRef.current) {
        clearPickerState()
        // User explicitly pressed Escape — confirm the dismissal with a
        // toast so the click that toggled the picker off feels acknowledged.
        showInfo('picker_cancelled')
      }
    },
    onError: (error) => {
      Logger.info('[Picker] bridge onError:', error)
      Logger.warn('[ElementPicker] Bridge error:', error)
      // The bridge unsubscribes before calling onError: the run is dead, so the
      // renderer state must not keep claiming an active picker.
      clearPickerState()
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

      if (activePickerContentRef.current && activePickerContentRef.current !== content) {
        stopListening()
        await resetPickerArtifacts(activePickerContentRef.current)
        activePickerContentRef.current = null
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
      await runWithTimeout(content.executeJavaScript(PICKER_SCRIPTS.RESET))
      activePickerContentRef.current = content
      pickerSessionRef.current = sessionId
      pickerStartUrlRef.current = readContentUrl(content)
      startListening(content, sessionId)
      await runWithTimeout(content.executeJavaScript(script))
      if (getContentRef.current() !== content || content.isDestroyed?.() === true) {
        stopListening()
        activePickerContentRef.current = null
        pickerSessionRef.current = null
        pickerStartUrlRef.current = null
        await resetPickerArtifacts(content)
        return
      }
      Logger.info('[Picker] startPicker: script injected into content, setting isPickerActive=true')

      setIsPickerActive(true)
      showInfo('picker_started_hint')
    } catch (err) {
      Logger.error('[Picker] startPicker: error', err)
      showError('picker_init_failed')
      // A timed-out injection may still land in the guest later. Best-effort
      // teardown so it does not leave an orphaned overlay/listener set behind.
      const failedContent = activePickerContentRef.current
      activePickerContentRef.current = null
      pickerSessionRef.current = null
      pickerStartUrlRef.current = null
      setIsPickerActive(false)
      stopListening()
      void resetPickerArtifacts(failedContent)
    } finally {
      startInFlightRef.current = false
    }
  }, [pickerTranslations, showError, showInfo, startListening, stopListening, generatePickerScript])

  const stopPicker = useCallback(async () => {
    stopListening()
    const content = activePickerContentRef.current ?? getContentRef.current()
    // Clear the renderer state first: a sleeping/crashed view can leave
    // `executeJavaScript` pending, and the toggle must not stay "active" while
    // the cleanup never settles. The page-side cleanup is idempotent, so it is
    // safe to let it finish after the UI is already back to neutral.
    clearPickerState()
    if (!content) {
      return
    }

    try {
      if (typeof content.executeJavaScript !== 'function') {
        throw new Error('content executeJavaScript not available')
      }

      await runWithTimeout(content.executeJavaScript(PICKER_SCRIPTS.CLEANUP))
    } catch (err) {
      Logger.error('Failed to stop picker:', err)
    }
    showInfo('picker_cancelled')
  }, [clearPickerState, showInfo, stopListening])

  /**
   * ESC from the app window.
   *
   * The injected script only sees keys that land in the guest document. When
   * the settings panel, a dialog or any app chrome holds focus, ESC never
   * reaches it and the picker could not be dismissed. This listener covers
   * exactly that case; while the guest view is focused the event does not
   * reach this window, so the two paths never double-fire.
   *
   * An open app overlay owns ESC: closing a dialog or menu must not also kill
   * the picker behind it. `[aria-modal]` is the app's own convention (see
   * AiSendComposer); menu/listbox surfaces are included because they handle
   * Escape themselves.
   */
  useEffect(() => {
    if (!isPickerActive) return

    const APP_OVERLAY_SELECTOR =
      '[aria-modal="true"], [role="menu"], [role="listbox"], [data-slot="menu-surface"]'

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector(APP_OVERLAY_SELECTOR)) return
      event.preventDefault()
      event.stopPropagation()
      Logger.info('[Picker] Escape pressed in the app window; stopping picker')
      void stopPicker()
    }

    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [isPickerActive, stopPicker])

  const togglePicker = useCallback(async () => {
    const currentContent = getContentRef.current()
    if (
      isPickerActive &&
      (!activePickerContentRef.current || activePickerContentRef.current === currentContent)
    ) {
      await stopPicker()
    } else {
      if (
        isPickerActive &&
        activePickerContentRef.current &&
        activePickerContentRef.current !== currentContent
      ) {
        stopListening()
        await resetPickerArtifacts(activePickerContentRef.current)
        activePickerContentRef.current = null
        pickerSessionRef.current = null
        pickerStartUrlRef.current = null
        setIsPickerActive(false)
      }
      await startPicker()
    }
  }, [isPickerActive, startPicker, stopListening, stopPicker])

  return {
    isPickerActive,
    startPicker,
    stopPicker,
    togglePicker
  }
}
