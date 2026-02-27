import { useElectronMutation } from '../useElectron'
import type { AutomationConfig } from '@shared/types'
import { useLanguage } from '@src/app/providers/LanguageContext'

/**
 * Generate Focus Script Mutation
 */
export function useGenerateFocusScript() {
    const { t } = useLanguage()

    return useElectronMutation<string | null, AutomationConfig>(
        (api, config) => api.automation.generateFocusScript(config),
        {
            errorMessage: t('toast_focus_script_failed')
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
            errorMessage: t('toast_click_script_failed')
        }
    )
}

/**
 * Generate Auto Send Script Mutation
 */
export function useGenerateAutoSendScript() {
    const { t } = useLanguage()

    return useElectronMutation<string | null, { config: AutomationConfig; text: string; submit: boolean }>(
        (api, { config, text, submit }) => api.automation.generateAutoSendScript(config, text, submit),
        {
            errorMessage: t('toast_autosend_script_failed')
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
            errorMessage: t('toast_picker_script_failed')
        }
    )
}

