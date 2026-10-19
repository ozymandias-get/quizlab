import type { AutomationConfig, TextInputMode } from '@shared-core/types'

import { useElectronMutation } from '../useElectron'

export function useGenerateFocusScript() {
  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateFocusScript(config),
    { showErrorToast: false }
  )
}

export function useGenerateClickSendScript() {
  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateClickSendScript(config),
    { showErrorToast: false }
  )
}

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

export function useGenerateValidateSelectorsScript() {
  return useElectronMutation<string | null, AutomationConfig>(
    (api, config) => api.automation.generateValidateSelectorsScript(config),
    { showErrorToast: false }
  )
}

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

export function useGeneratePickerScript() {
  return useElectronMutation<
    string | null,
    { translations: Record<string, string>; sessionId?: string }
  >(
    (api, { translations, sessionId }) =>
      api.automation.generatePickerScript(translations, sessionId),
    { showErrorToast: false }
  )
}
