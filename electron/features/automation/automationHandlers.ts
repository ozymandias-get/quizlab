import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../app/constants'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
import type {
  AutomationScriptAction,
  AutomationScriptArgsByAction,
  AutomationScriptInvokeArgs
} from '@shared-core/types/ipcContract'
import {
  generateFocusScript,
  generateClickSendScript,
  generateAutoSendScript,
  generateValidateSelectorsScript,
  generateWaitForSubmitReadyScript
} from './automationScripts'
import { generatePickerScript } from './userElementPicker'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOptionalObject(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || isObject(value)
}

const automationHandlers: {
  [A in AutomationScriptAction]: (...args: AutomationScriptArgsByAction[A]) => string | null
} = {
  generateFocusScript: (config) => generateFocusScript(config),
  generateClickSendScript: (config) => generateClickSendScript(config),
  generateAutoSendScript: (config, text, submit, append) =>
    generateAutoSendScript(config, text, submit, append === true),
  generateValidateSelectorsScript: (config) => generateValidateSelectorsScript(config),
  generateWaitForSubmitReadyScript: (config, options) =>
    generateWaitForSubmitReadyScript(config, options),
  generatePickerScript: (translations) => generatePickerScript(translations)
}

export function registerAutomationHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG

  ipcMain.handle(
    IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
    (event, ...invokeArgs: AutomationScriptInvokeArgs) => {
      try {
        if (!requireTrustedIpcSender(event)) return null
        const [action] = invokeArgs
        switch (action) {
          case 'generateFocusScript': {
            const [, config] = invokeArgs as Extract<
              AutomationScriptInvokeArgs,
              ['generateFocusScript', ...unknown[]]
            >
            if (!isObject(config)) return null
            return automationHandlers.generateFocusScript(config)
          }
          case 'generateClickSendScript': {
            const [, config] = invokeArgs as Extract<
              AutomationScriptInvokeArgs,
              ['generateClickSendScript', ...unknown[]]
            >
            if (!isObject(config)) return null
            return automationHandlers.generateClickSendScript(config)
          }
          case 'generateAutoSendScript': {
            const [, config, text, submit, append] = invokeArgs as Extract<
              AutomationScriptInvokeArgs,
              ['generateAutoSendScript', ...unknown[]]
            >
            if (!isObject(config) || typeof text !== 'string' || typeof submit !== 'boolean')
              return null
            return automationHandlers.generateAutoSendScript(config, text, submit, append)
          }
          case 'generateValidateSelectorsScript': {
            const [, config] = invokeArgs as Extract<
              AutomationScriptInvokeArgs,
              ['generateValidateSelectorsScript', ...unknown[]]
            >
            if (!isObject(config)) return null
            return automationHandlers.generateValidateSelectorsScript(config)
          }
          case 'generateWaitForSubmitReadyScript': {
            const [, config, options] = invokeArgs as Extract<
              AutomationScriptInvokeArgs,
              ['generateWaitForSubmitReadyScript', ...unknown[]]
            >
            if (!isObject(config) || !isOptionalObject(options)) return null
            return automationHandlers.generateWaitForSubmitReadyScript(config, options)
          }
          case 'generatePickerScript': {
            const [, translations] = invokeArgs as Extract<
              AutomationScriptInvokeArgs,
              ['generatePickerScript', ...unknown[]]
            >
            if (!isObject(translations)) return null
            return automationHandlers.generatePickerScript(translations)
          }
          default:
            return null
        }
      } catch (error) {
        console.error('[IPC] Automation script error:', error)
        return null
      }
    }
  )
}
