import type { AutomationConfig, TextInputMode } from '@shared-core/types'

import { useElectronMutation } from '../useElectron'

/**
 * Generate Focus Script Mutation
 */
export function useGenerateFocusScript() {
  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateFocusScript(config),
    { showErrorToast: false }
  )
}

/**
 * Generate Click & Send Script Mutation
 */
export function useGenerateClickSendScript() {
  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateClickSendScript(config),
    { showErrorToast: false }
  )
}

/**
 * Generate Auto Send Script Mutation
 */
export function useGenerateAutoSendScript() {
  return useElectronMutation<
    string | null,
    {
      config: AutomationConfig
      text: string
      submit: boolean
      append?: boolean
      textInputMode?: TextInputMode
      typingSpeed?: number
    }
  >(
    (api, { config, text, submit, append, textInputMode, typingSpeed }) =>
      api.automation.generateAutoSendScript(
        config,
        text,
        submit,
        append === true,
        textInputMode,
        typingSpeed
      ),
    { showErrorToast: false }
  )
}

/**
 * Generate Validate Selectors Script Mutation
 */
export function useGenerateValidateSelectorsScript() {
  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateValidateSelectorsScript(config),
    { showErrorToast: false }
  )
}

/**
 * Generate submit-ready wait script
 */
export function useGenerateWaitForSubmitReadyScript() {
  return useElectronMutation<
    string | null,
    {
      config: AutomationConfig
      options?: { timeoutMs?: number; settleMs?: number; minimumWaitMs?: number }
    }
  >(
    (api, { config, options }) => api.automation.generateWaitForSubmitReadyScript(config, options),
    { showErrorToast: false }
  )
}

/**
 * Generate Picker Script Mutation
 */
export function useGeneratePickerScript() {
  return useElectronMutation<string | null, Record<string, string>>(
    (api, translations) => api.automation.generatePickerScript(translations),
    { showErrorToast: false }
  )
}
