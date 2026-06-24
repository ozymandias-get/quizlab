import type { AutomationConfig, TextInputMode } from '@shared-core/types'
import type {
  AutomationScriptAction,
  AutomationScriptArgsByAction,
  AutomationScriptInvokeArgs
} from '@shared-core/types/ipcContract'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import {
  generateAutoSendScript,
  generateClickSendScript,
  generateFocusScript,
  generateValidateSelectorsScript,
  generateWaitForSubmitReadyScript
} from './automationScripts.js'
import { generatePickerScript } from './userElementPicker.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOptionalObject(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || isObject(value)
}

// SECURITY: Maximum size for text being embedded into generated scripts.
// Larger values would produce an oversized script string that could exhaust
// IPC buffer limits or cause OOM in the renderer when the script is parsed.
const MAX_AUTO_SEND_TEXT_LENGTH = 100 * 1024 // 100 KB

type ActionGuard<A extends AutomationScriptAction> = (
  args: unknown[]
) => args is AutomationScriptArgsByAction[A]

const actionGuard: {
  [A in AutomationScriptAction]: ActionGuard<A>
} = {
  generateFocusScript: (args): args is [config: Record<string, unknown>] => isObject(args[0]),
  generateClickSendScript: (args): args is [config: Record<string, unknown>] => isObject(args[0]),
  generateAutoSendScript: (
    args
  ): args is [
    config: AutomationConfig,
    text: string,
    submit: boolean,
    append?: boolean,
    textInputMode?: TextInputMode,
    typingSpeed?: number
  ] => isObject(args[0]) && typeof args[1] === 'string' && typeof args[2] === 'boolean',
  generateValidateSelectorsScript: (args): args is [config: Record<string, unknown>] =>
    isObject(args[0]),
  generateWaitForSubmitReadyScript: (
    args
  ): args is [config: Record<string, unknown>, options?: Record<string, unknown>] =>
    isObject(args[0]) && isOptionalObject(args[1]),
  generatePickerScript: (args): args is [translations: Record<string, string>] => isObject(args[0])
}

const actionHandlers: {
  [A in AutomationScriptAction]: (...args: AutomationScriptArgsByAction[A]) => string | null
} = {
  generateFocusScript: (config) => generateFocusScript(config),
  generateClickSendScript: (config) => generateClickSendScript(config),
  generateAutoSendScript: (config, text, submit, append, textInputMode, typingSpeed) =>
    generateAutoSendScript(config, text, submit, append === true, textInputMode, typingSpeed),
  generateValidateSelectorsScript: (config) => generateValidateSelectorsScript(config),
  generateWaitForSubmitReadyScript: (config, options) =>
    generateWaitForSubmitReadyScript(config, options),
  generatePickerScript: (translations) => generatePickerScript(translations)
}

let handlersRegistered = false

export function registerAutomationHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
    (event, ...invokeArgs: AutomationScriptInvokeArgs) => {
      try {
        const [action, ...args] = invokeArgs

        const guard = actionGuard[action as AutomationScriptAction]
        if (!guard || !guard(args)) return failure('invalid_input', 'Invalid action or arguments')

        if (action === 'generateAutoSendScript') {
          const text = args[1] as string
          if (text.length > MAX_AUTO_SEND_TEXT_LENGTH) {
            Logger.warn(
              `[Automation] Rejected oversized auto-send text: ${text.length} chars (max ${MAX_AUTO_SEND_TEXT_LENGTH})`
            )
            return failure('invalid_input', 'Oversized auto-send text rejected')
          }
        }

        const result = (
          actionHandlers[action as AutomationScriptAction] as (...a: unknown[]) => string | null
        )(...args)
        return result !== null
          ? success(result)
          : failure('internal_error', 'Script generation returned null')
      } catch (error) {
        Logger.error('[IPC] Automation script error:', error)
        return failure('internal_error', (error as Error).message)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
