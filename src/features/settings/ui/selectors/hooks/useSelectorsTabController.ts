import { useCallback, useMemo, useState } from 'react'
import { useAppToolActions, useLanguageStrings, useToastActions } from '@app/providers'
import {
  useAiCoreWorkspaceActions,
  useAiModelsCatalog,
  useAiTabsSliceState,
  useAiWebview
} from '@app/providers/AiContext'
import { useAiConfig, useDeleteAiConfig, useSaveAiConfig } from '@platform/electron/api/useAiApi'
import { useGenerateValidateSelectorsScript } from '@platform/electron/api/useAutomationApi'
import { normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { SubmitMode } from '@shared-core/types'
import { Logger } from '@shared/lib/logger'
import {
  hasSelectorLocator,
  normalizeExecutionResult,
  normalizeSelectorsData,
  toAutomationConfig
} from '../selectorUtils'
import type { AiEntry, SelectorEntry, ValidationState } from '../types'

interface UseSelectorsTabControllerOptions {
  onCloseSettings?: () => void
}

export function useSelectorsTabController({ onCloseSettings }: UseSelectorsTabControllerOptions) {
  const { tabs, currentAI } = useAiTabsSliceState()
  const { aiSites } = useAiModelsCatalog()
  const { webviewInstance } = useAiWebview()
  const { startTutorial, openAiWorkspace } = useAiCoreWorkspaceActions()
  const { startPickerWhenReady } = useAppToolActions()
  const { showError, showSuccess, showWarning } = useToastActions()
  const { t } = useLanguageStrings()
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
      }
    },
    [deleteConfig, t]
  )

  const handleStartTutorial = useCallback(() => {
    startTutorial()
    onCloseSettings?.()
  }, [onCloseSettings, startTutorial])

  const toggleExpanded = useCallback((id: string) => {
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
      }
    },
    [saveAiConfig]
  )

  const handleOpenRepick = useCallback(
    (aiKey: string, cardId: string) => {
      setExpandedIds((current) => (current.includes(cardId) ? current : [...current, cardId]))
      setValidationState((current) => ({
        ...current,
        [cardId]: { status: 'idle' }
      }))

      openAiWorkspace(aiKey)
      startPickerWhenReady()
      onCloseSettings?.()
    },
    [onCloseSettings, openAiWorkspace, startPickerWhenReady]
  )

  const handleTestSelectors = useCallback(
    async (aiKey: string, selectorEntry: SelectorEntry | null, cardId: string) => {
      if (!selectorEntry || !hasSelectorLocator(selectorEntry.config)) {
        const error = t('selectors_test_no_config')
        setValidationState((current) => ({
          ...current,
          [cardId]: { status: 'error', error }
        }))
        showWarning(error, t('toast_automation_title'))
        return
      }

      if (
        !webviewInstance ||
        currentAI !== aiKey ||
        typeof webviewInstance.executeJavaScript !== 'function'
      ) {
        const error = t('selectors_test_requires_active_tab')
        setValidationState((current) => ({
          ...current,
          [cardId]: { status: 'error', error }
        }))
        showWarning(error, t('toast_automation_title'))
        return
      }

      setValidationState((current) => ({
        ...current,
        [cardId]: { status: 'loading' }
      }))

      try {
        const script = await generateValidateSelectorsScript(toAutomationConfig(selectorEntry.config))
        if (!script) {
          throw new Error('validate_script_missing')
        }

        const rawResult = await webviewInstance.executeJavaScript(script)
        const result = normalizeExecutionResult(rawResult)
        const diagnostics = result?.diagnostics || null

        if (result?.success) {
          setValidationState((current) => ({
            ...current,
            [cardId]: {
              status: 'success',
              diagnostics
            }
          }))
          showSuccess(t('selectors_test_success'), t('toast_automation_title'))
          return
        }

        const errorKey = result?.error ? `error_${result.error}` : 'selectors_test_failed'
        const errorMessage = t(errorKey)
        setValidationState((current) => ({
          ...current,
          [cardId]: {
            status: 'error',
            error: errorMessage,
            diagnostics
          }
        }))
        showWarning(errorMessage, t('toast_automation_title'))
      } catch (err) {
        Logger.error('Failed to validate selectors', err)
        const errorMessage = t('selectors_test_failed')
        setValidationState((current) => ({
          ...current,
          [cardId]: {
            status: 'error',
            error: errorMessage
          }
        }))
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
      webviewInstance
    ]
  )

  return {
    t,
    tabs,
    currentAI,
    webviewInstance,
    selectors,
    aiEntries,
    expandedIds,
    validationState,
    isSaving,
    isDeleting,
    isTesting,
    handleDeleteSelectors,
    handleStartTutorial,
    toggleExpanded,
    handleSubmitModeChange,
    handleOpenRepick,
    handleTestSelectors
  }
}
