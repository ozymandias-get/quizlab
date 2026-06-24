import { normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { SubmitMode } from '@shared-core/types'

import { useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGenerateValidateSelectorsScript } from '@platform/electron/api/useAutomationApi'
import { useAiConfig, useDeleteAiConfig } from '@platform/electron/api/useSettingsAiApi'

import { normalizeExecutionResult } from '@features/ai'

import { useAppToolActions, useToastActions } from '@app/providers'
import {
  useAiSessionActions,
  useAiSites,
  useAiTabActions,
  useAiTabFocus,
  useAiTabsList,
  useAiWebview,
  useAiWebviewPresence
} from '@app/providers/AiContext'
import { Logger } from '@shared/lib/logger'

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { hasSelectorLocator, normalizeSelectorsData, toAutomationConfig } from '../selectorUtils'
import type { AiEntry, SelectorEntry, ValidationState } from '../types'

interface UseSelectorsTabControllerOptions {
  onCloseSettings?: () => void
}

export function useSelectorsTabController({ onCloseSettings }: UseSelectorsTabControllerOptions) {
  const { tabs } = useAiTabsList()
  const { currentAI } = useAiTabFocus()
  const aiSites = useAiSites()
  const { getWebviewInstance } = useAiWebview()
  const { hasActiveWebview } = useAiWebviewPresence()
  const { openAiWorkspace } = useAiTabActions()
  const { startTutorial } = useAiSessionActions()
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

  const handleStartTutorial = useCallback(() => {
    startTutorial()
    onCloseSettings?.()
  }, [onCloseSettings, startTutorial])

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

  const handleTestSelectors = useCallback(
    async (aiKey: string, selectorEntry: SelectorEntry | null, cardId: string) => {
      if (!selectorEntry || !hasSelectorLocator(selectorEntry.config)) {
        const error = t('selectors_test_no_config')
        setCardValidation(cardId, { status: 'error', error })
        showWarning(error, t('toast_automation_title'))
        return
      }

      const webviewInstance = getWebviewInstance()
      if (
        !webviewInstance ||
        currentAI !== aiKey ||
        typeof webviewInstance.executeJavaScript !== 'function'
      ) {
        const error = t('selectors_test_requires_active_tab')
        setCardValidation(cardId, { status: 'error', error })
        showWarning(error, t('toast_automation_title'))
        return
      }

      setCardValidation(cardId, { status: 'loading' })

      try {
        const script = await generateValidateSelectorsScript(
          toAutomationConfig(selectorEntry.config)
        )
        if (!script) {
          throw new Error('validate_script_missing')
        }

        const rawResult = await webviewInstance.executeJavaScript(script)
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
    [
      currentAI,
      generateValidateSelectorsScript,
      showError,
      showSuccess,
      showWarning,
      t,
      getWebviewInstance,
      setCardValidation
    ]
  )

  return {
    t,
    tabs,
    currentAI,
    hasWebview: hasActiveWebview,
    selectors,
    aiEntries,
    expandedIds,
    validationState,
    isSaving,
    isDeleting,
    isTesting,
    handleDeleteSelectors,
    handleStartTutorial,
    handleToggleExpanded,
    handleSubmitModeChange,
    handleOpenRepick,
    handleTestSelectors
  }
}
