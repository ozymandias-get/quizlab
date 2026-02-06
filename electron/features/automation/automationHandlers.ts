import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../main/constants'
import {
    generateFocusScript,
    generateClickSendScript,
    generateAutoSendScript,
    type AutomationConfig
} from './automationScripts'
import { generatePickerScript } from './userElementPicker'

export function registerAutomationHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG

    ipcMain.handle(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, (event, action: string, ...args: unknown[]) => {
        try {
            switch (action) {
                case 'generateFocusScript': {
                    const config = (args[0] || {}) as AutomationConfig
                    return generateFocusScript(config)
                }
                case 'generateClickSendScript': {
                    const config = (args[0] || {}) as AutomationConfig
                    return generateClickSendScript(config)
                }
                case 'generateAutoSendScript': {
                    const config = (args[0] || {}) as AutomationConfig
                    const text = typeof args[1] === 'string' ? args[1] : ''
                    const submit = typeof args[2] === 'boolean' ? args[2] : true
                    return generateAutoSendScript(config, text, submit)
                }
                case 'generatePickerScript': {
                    const translations = (args[0] || {}) as Record<string, string>
                    return generatePickerScript(translations)
                }
                default: return null
            }
        } catch (error) {
            console.error('[IPC] Automation script error:', error)
            return null
        }
    })
}
