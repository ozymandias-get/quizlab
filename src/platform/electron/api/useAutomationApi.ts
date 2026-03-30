import { useElectronMutation } from '../useElectron'
import type { AutomationConfig } from '@shared-core/types'
import { useLanguage } from '@app/providers/LanguageContext'

/**
 * Generate Focus Script Mutation
 */
export function useGenerateFocusScript() {
  const { t } = useLanguage()

  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateFocusScript(config),
    {
      errorMessage: t('toast_focus_script_failed'),
      showErrorToast: false
    }
  )
}

/**
 * Generate Click & Send Script Mutation
 */
export function useGenerateClickSendScript() {
  const { t } = useLanguage()

  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateClickSendScript(config),
    {
      errorMessage: t('toast_click_script_failed'),
      showErrorToast: false
    }
  )
}

/**
 * Generate Auto Send Script Mutation
 */
export function useGenerateAutoSendScript() {
  const { t } = useLanguage()

  return useElectronMutation<
    string | null,
    { config: AutomationConfig; text: string; submit: boolean; append?: boolean }
  >(
    (api, { config, text, submit, append }) =>
      api.automation.generateAutoSendScript(config, text, submit, append === true),
    {
      errorMessage: t('toast_autosend_script_failed'),
      showErrorToast: false
    }
  )
}

/**
 * Generate Validate Selectors Script Mutation
 */
export function useGenerateValidateSelectorsScript() {
  const { t } = useLanguage()

  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateValidateSelectorsScript(config),
    {
      errorMessage: t('toast_validate_script_failed'),
      showErrorToast: false
    }
  )
}

/**
 * Generate submit-ready wait script
 */
export function useGenerateWaitForSubmitReadyScript() {
  const { t } = useLanguage()

  return useElectronMutation<
    string | null,
    {
      config: AutomationConfig
      options?: { timeoutMs?: number; settleMs?: number; minimumWaitMs?: number }
    }
  >(
    (api, { config, options }) => api.automation.generateWaitForSubmitReadyScript(config, options),
    {
      errorMessage: t('toast_submit_ready_script_failed'),
      showErrorToast: false
    }
  )
}

/**
 * Generate Picker Script Mutation
 */
export function useGeneratePickerScript() {
  const { t } = useLanguage()
  return useElectronMutation<string | null, Record<string, string>>(
    (api, translations) => api.automation.generatePickerScript(translations),
    {
      errorMessage: t('toast_picker_script_failed'),
      showErrorToast: false
    }
  )
}
