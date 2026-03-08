import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../app/constants'
import {
    generateFocusScript,
    generateClickSendScript,
    generateAutoSendScript,
    type AutomationConfig
} from './automationScripts'
import { generatePickerScript } from './userElementPicker'

export function registerAutomationHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG
    const readConfig = (value: unknown) => (value || {}) as AutomationConfig
    const handlers = {
        generateFocusScript: (args: unknown[]) => generateFocusScript(readConfig(args[0])),
        generateClickSendScript: (args: unknown[]) => generateClickSendScript(readConfig(args[0])),
        generateAutoSendScript: (args: unknown[]) => {
            const text = typeof args[1] === 'string' ? args[1] : ''
            const submit = typeof args[2] === 'boolean' ? args[2] : true
            return generateAutoSendScript(readConfig(args[0]), text, submit)
        },
        generatePickerScript: (args: unknown[]) => generatePickerScript((args[0] || {}) as Record<string, string>)
    } satisfies Record<string, (args: unknown[]) => string | null>

    ipcMain.handle(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, (_event, action: string, ...args: unknown[]) => {
        try {
            const handler = handlers[action as keyof typeof handlers]
            return handler ? handler(args) : null
        } catch (error) {
            console.error('[IPC] Automation script error:', error)
            return null
        }
    })
}

