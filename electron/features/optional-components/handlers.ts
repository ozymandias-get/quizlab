import { failure, success } from '../../../shared/lib/typedIpc.js'
import {
  OPTIONAL_COMPONENT_ACTIONS,
  type OptionalComponentAction
} from '../../../shared/types/index.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { ensureBuiltInComponentsRegistered } from './builtInComponents.js'
import {
  getOptionalComponentState,
  listOptionalComponentStates,
  OptionalComponentNotFoundError,
  runOptionalComponentAction
} from './componentManager.js'

/**
 * SECURITY: The renderer may only address optional components by whitelisted
 * id and a fixed action name. No paths, commands or arbitrary payloads are
 * accepted; unknown ids never reach the component definitions.
 */

const COMPONENT_ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/

function isValidComponentId(value: unknown): value is string {
  return typeof value === 'string' && COMPONENT_ID_PATTERN.test(value)
}

function isValidAction(value: unknown): value is OptionalComponentAction {
  return (
    typeof value === 'string' && (OPTIONAL_COMPONENT_ACTIONS as readonly string[]).includes(value)
  )
}

let handlersRegistered = false

export function registerOptionalComponentsHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ensureBuiltInComponentsRegistered()

  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.OPTIONAL_COMPONENTS_LIST,
    async () => success(await listOptionalComponentStates()),
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.OPTIONAL_COMPONENTS_GET_STATE,
    async (_event, componentId) => {
      if (!isValidComponentId(componentId)) return success(null)
      return success(await getOptionalComponentState(componentId))
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.OPTIONAL_COMPONENTS_RUN_ACTION,
    async (_event, componentId, action) => {
      if (!isValidComponentId(componentId)) {
        return failure('invalid_input', 'Invalid component id')
      }
      if (!isValidAction(action)) {
        return failure('invalid_input', 'Invalid component action')
      }

      try {
        return success(await runOptionalComponentAction(componentId, action))
      } catch (error) {
        if (error instanceof OptionalComponentNotFoundError) {
          return failure('not_found', error.message)
        }
        throw error
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
