import { normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { SubmitMode } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGenerateValidateSelectorsScript } from '@platform/electron/api/useAutomationApi'
import { useAiConfig, useDeleteAiConfig } from '@platform/electron/api/useSettingsAiApi'

import { normalizeExecutionResult } from '@features/ai'

import { useAppToolActions, useToastActions } from '@app/providers'
import {
  useAiContent,
  useAiContentPresence,
  useAiSites,
  useAiTabActions,
  useAiTabFocus,
  useAiTabsList
} from '@app/providers/ai-context'
import {
  oncePickerReady,
  waitForContentReady
} from '@app/providers/app-tool/aiContentPickerReadiness'
import { Logger } from '@shared/lib/logger'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { hasSelectorLocator, normalizeSelectorsData, toAutomationConfig } from '../selectorUtils'
import type { AiEntry, SelectorEntry, ValidationState } from '../types'

interface UseSelectorsTabControllerOptions {
  onCloseSettings?: () => void
}

/** How long an auto-opened platform tab may take to become testable. */
const OPEN_TAB_TEST_TIMEOUT_MS = 15_000

export function useSelectorsTabController({ onCloseSettings }: UseSelectorsTabControllerOptions) {
  const { tabs } = useAiTabsList()
  const { activeTabId, currentAI } = useAiTabFocus()
  const aiSites = useAiSites()
  const { getContentController } = useAiContent()
  const { hasActiveContent } = useAiContentPresence()
  const { openAiWorkspace } = useAiTabActions()
  const { startPickerWhenReady } = useAppToolActions()
  const { showError, showSuccess, showWarning } = useToastActions()
  const { t } = useTranslation()
  const { data: selectorsData } = useAiConfig()
  const { mutateAsync: deleteConfig, isPending: isDeleting } = useDeleteAiConfig()
  const { mutateAsync: saveAiConfig, isPending: isSaving } = useSaveAiConfig()
  const { mutateAsync: generateValidateSelectorsScript, isPending: isTesting } =
    useGenerateValidateSelectorsScript()
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [validationState, setValidationState] = useState<Record<string, ValidationState>>({})

  const selectors = useMemo(() => normalizeSelectorsData(selectorsData), [selectorsData])

  const aiEntries = useMemo<AiEntry[]>(
    () =>
      Object.entries(aiSites)
        .filter(([, ai]) => !ai.isSite)
        .map(([key, ai]) => ({ key, ai })),
    [aiSites]
  )

  const handleDeleteSelectors = useCallback(
    async (hostname: string) => {
      if (!confirm(t('confirm_delete_selectors'))) {
        return
      }

      try {
        await deleteConfig(hostname)
      } catch (err) {
        Logger.error('Failed to delete selectors', err)
        showError('toast_ai_config_delete_failed')
      }
    },
    [deleteConfig, t, showError]
  )

  const handleToggleExpanded = useCallback((id: string) => {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((entryId) => entryId !== id) : [...current, id]
    )
  }, [])

  const handleSubmitModeChange = useCallback(
    async (hostname: string, nextMode: SubmitMode) => {
      try {
        await saveAiConfig({
          hostname,
          config: {
            version: 2,
            submitMode: normalizeSubmitMode(nextMode) || 'mixed'
          }
        })
      } catch (err) {
        Logger.error('Failed to update selector submit mode', err)
        showError('toast_ai_config_save_failed')
      }
    },
    [saveAiConfig, showError]
  )

  const setCardValidation = useCallback((cardId: string, next: ValidationState) => {
    setValidationState((current) => ({ ...current, [cardId]: next }))
  }, [])

  const handleOpenRepick = useCallback(
    (aiKey: string, cardId: string) => {
      setExpandedIds((current) => (current.includes(cardId) ? current : [...current, cardId]))
      setCardValidation(cardId, { status: 'idle' })

      openAiWorkspace(aiKey)
      startPickerWhenReady()
      onCloseSettings?.()
    },
    [onCloseSettings, openAiWorkspace, startPickerWhenReady, setCardValidation]
  )

  const executeSelectorTest = useCallback(
    async (
      selectorEntry: SelectorEntry,
      cardId: string,
      contentController: AiContentController
    ) => {
      setCardValidation(cardId, { status: 'loading' })

      try {
        const script = await generateValidateSelectorsScript(
          toAutomationConfig(selectorEntry.config)
        )
        if (!script) {
          throw new Error('validate_script_missing')
        }

        const rawResult = await contentController.executeJavaScript(script)
        const result = normalizeExecutionResult(rawResult)
        const diagnostics = result?.diagnostics || null

        if (result?.success) {
          setCardValidation(cardId, { status: 'success', diagnostics })
          showSuccess(t('selectors_test_success'), t('toast_automation_title'))
          return
        }

        const errorKey = result?.error ? `error_${result.error}` : 'selectors_test_failed'
        const errorMessage = t(errorKey)
        setCardValidation(cardId, { status: 'error', error: errorMessage, diagnostics })
        showWarning(errorMessage, t('toast_automation_title'))
      } catch (err) {
        Logger.error('Failed to validate selectors', err)
        const errorMessage = t('selectors_test_failed')
        setCardValidation(cardId, { status: 'error', error: errorMessage })
        showError(errorMessage, t('toast_automation_title'))
      }
    },
    [generateValidateSelectorsScript, setCardValidation, showError, showSuccess, showWarning, t]
  )

  /**
   * A selector test needs a live controller for *that platform's* tab. If the
   * tab is not active (or has not loaded yet), the test opens it and parks the
   * request until the tab registers content; the effect below executes it once
   * the page is ready. Without this the user had to close settings, find the
   * tab, and come back to the same card.
   */
  const pendingTestRef = useRef<{
    aiKey: string
    selectorEntry: SelectorEntry
    cardId: string
  } | null>(null)
  const pendingTestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingTestTimeout = useCallback(() => {
    if (pendingTestTimeoutRef.current === null) return
    clearTimeout(pendingTestTimeoutRef.current)
    pendingTestTimeoutRef.current = null
  }, [])

  /** Drops a parked test and releases the card's loading state. */
  const discardPendingTest = useCallback(() => {
    const previous = pendingTestRef.current
    if (!previous) return
    pendingTestRef.current = null
    setCardValidation(previous.cardId, { status: 'idle' })
  }, [setCardValidation])

  useEffect(() => () => clearPendingTestTimeout(), [clearPendingTestTimeout])

  const handleTestSelectors = useCallback(
    async (aiKey: string, selectorEntry: SelectorEntry | null, cardId: string) => {
      if (!selectorEntry || !hasSelectorLocator(selectorEntry.config)) {
        const error = t('selectors_test_no_config')
        setCardValidation(cardId, { status: 'error', error })
        showWarning(error, t('toast_automation_title'))
        return
      }

      const contentController = getContentController()
      if (
        currentAI === aiKey &&
        contentController &&
        typeof contentController.executeJavaScript === 'function'
      ) {
        discardPendingTest()
        clearPendingTestTimeout()
        await executeSelectorTest(selectorEntry, cardId, contentController)
        return
      }

      discardPendingTest()
      pendingTestRef.current = { aiKey, selectorEntry, cardId }
      clearPendingTestTimeout()
      // The tab may never produce content (registry failure, crash). Bound the
      // wait so the card cannot keep a spinner forever.
      pendingTestTimeoutRef.current = setTimeout(() => {
        pendingTestTimeoutRef.current = null
        const pending = pendingTestRef.current
        if (!pending) return
        pendingTestRef.current = null
        const message = t('selectors_test_open_tab_timeout')
        setCardValidation(pending.cardId, { status: 'error', error: message })
        showWarning(message, t('toast_automation_title'))
      }, OPEN_TAB_TEST_TIMEOUT_MS)

      setCardValidation(cardId, { status: 'loading' })
      openAiWorkspace(aiKey)
    },
    [
      clearPendingTestTimeout,
      currentAI,
      discardPendingTest,
      executeSelectorTest,
      getContentController,
      openAiWorkspace,
      setCardValidation,
      showWarning,
      t
    ]
  )

  useEffect(() => {
    const pending = pendingTestRef.current
    if (!pending || currentAI !== pending.aiKey) return

    const contentController = getContentController()
    if (!contentController || typeof contentController.executeJavaScript !== 'function') return

    // One-shot: clear before awaiting, so a presence re-render cannot start the
    // same validation twice. The queue-side timeout is replaced by the
    // in-flight readiness timeout below.
    pendingTestRef.current = null
    clearPendingTestTimeout()

    const abort = new AbortController()
    let timedOut = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    const reportFailure = (message: string) => {
      setCardValidation(pending.cardId, { status: 'error', error: message })
      showWarning(message, t('toast_automation_title'))
    }

    const run = async () => {
      timeout = setTimeout(() => {
        timedOut = true
        abort.abort()
        reportFailure(t('selectors_test_open_tab_timeout'))
      }, OPEN_TAB_TEST_TIMEOUT_MS)

      try {
        // The tab may have been opened by this click; wait for the managed view
        // and its document before injecting the validation script.
        try {
          await waitForContentReady(contentController, abort.signal)
        } catch (err) {
          if (abort.signal.aborted) throw err
        }
        try {
          await oncePickerReady(contentController, abort.signal)
        } catch (err) {
          if (abort.signal.aborted) throw err
        }

        if (abort.signal.aborted) return
        await executeSelectorTest(pending.selectorEntry, pending.cardId, contentController)
      } catch (err) {
        if (timedOut) return
        if (abort.signal.aborted) {
          // The user switched away or closed the tab while waiting; put the
          // card back to a neutral state instead of leaving a spinner forever.
          setCardValidation(pending.cardId, { status: 'idle' })
          return
        }
        Logger.error('Failed to open the platform tab for selector test', err)
        reportFailure(t('selectors_test_failed'))
      } finally {
        if (timeout) clearTimeout(timeout)
      }
    }

    void run()

    return () => {
      abort.abort()
      if (timeout) clearTimeout(timeout)
    }
  }, [
    activeTabId,
    currentAI,
    clearPendingTestTimeout,
    hasActiveContent,
    executeSelectorTest,
    getContentController,
    setCardValidation,
    showWarning,
    t
  ])

  return {
    t,
    tabs,
    currentAI,
    hasContent: hasActiveContent,
    selectors,
    aiEntries,
    expandedIds,
    validationState,
    isSaving,
    isDeleting,
    isTesting,
    handleDeleteSelectors,
    handleToggleExpanded,
    handleSubmitModeChange,
    handleOpenRepick,
    handleTestSelectors
  }
}
