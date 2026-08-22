import type {
  OptionalComponentAction,
  OptionalComponentActionResult,
  OptionalComponentInfo,
  OptionalComponentStatus
} from '../../../shared/types/index.js'
import { Logger } from '../../core/logger.js'
import { getOptionalComponent, listOptionalComponents } from './componentRegistry.js'
import { getComponentPersistedState, setComponentPersistedState } from './componentStateStore.js'
import type { OptionalComponentDefinition, OptionalComponentPersistedState } from './types.js'
import {
  ACTION_BUSY_STATUS,
  ACTION_ENTRY_STATUSES,
  ACTION_SUCCESS_STATUS,
  isBusyStatus
} from './types.js'

/**
 * Orchestrates lifecycle actions for whitelisted optional components.
 * All state transitions are serialized per component and persisted to
 * userData/components.json before and after the underlying operation runs,
 * so the renderer always observes a consistent snapshot.
 */

/** One in-flight operation per component; concurrent calls fail fast. */
const inFlight = new Map<string, Promise<OptionalComponentActionResult>>()

export class OptionalComponentNotFoundError extends Error {
  constructor(componentId: string) {
    super(`Unknown optional component: "${componentId}"`)
    this.name = 'OptionalComponentNotFoundError'
  }
}

function toInfo(
  componentId: string,
  displayName: string,
  persisted: OptionalComponentPersistedState
): OptionalComponentInfo {
  return {
    id: componentId,
    displayName,
    version: persisted.status === 'not_installed' ? null : persisted.version,
    installed: isArtifactPresent(persisted.status),
    status: persisted.status,
    error: persisted.error,
    updatedAt: persisted.updatedAt
  }
}

/**
 * Whether the component's artifacts are (still) expected on disk for the given
 * lifecycle status. "installing" counts as absent until it succeeds; "error"
 * is ambiguous by definition and therefore reported as absent.
 */
function isArtifactPresent(status: OptionalComponentStatus): boolean {
  return (
    status === 'installed' ||
    status === 'updating' ||
    status === 'repairing' ||
    status === 'uninstalling' ||
    status === 'broken'
  )
}

async function readInfo(definition: OptionalComponentDefinition): Promise<OptionalComponentInfo> {
  const persisted = await getComponentPersistedState(definition.id)
  return toInfo(definition.id, definition.displayName, persisted)
}

async function persistStatus(
  componentId: string,
  patch: Partial<Pick<OptionalComponentPersistedState, 'status' | 'version' | 'error'>>
): Promise<void> {
  await setComponentPersistedState(componentId, patch)
}

async function runLifecycleOperation(
  definition: OptionalComponentDefinition,
  action: Exclude<OptionalComponentAction, 'health_check'>,
  current: OptionalComponentPersistedState
): Promise<OptionalComponentActionResult> {
  const busyStatus = ACTION_BUSY_STATUS[action]

  if (!ACTION_ENTRY_STATUSES[action].includes(current.status)) {
    return {
      success: false,
      error: `cannot ${action} while status is "${current.status}"`,
      component: toInfo(definition.id, definition.displayName, current)
    }
  }

  // Persist the in-flight status first so a crash mid-operation leaves a
  // visible trace instead of silently reverting to a stale terminal state.
  await persistStatus(definition.id, { status: busyStatus, error: null })

  try {
    await definition[action]()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Logger.error(`[OptionalComponents] ${action} failed for "${definition.id}"`, error)
    await persistStatus(definition.id, { status: 'error', version: null, error: message })
    const failed = await readInfo(definition)
    return { success: false, error: message, component: failed }
  }

  await persistStatus(definition.id, {
    status: ACTION_SUCCESS_STATUS[action],
    version: action === 'uninstall' ? null : definition.version,
    error: null
  })
  const updated = await readInfo(definition)
  return { success: true, component: updated }
}

async function runHealthCheck(
  definition: OptionalComponentDefinition,
  current: OptionalComponentPersistedState
): Promise<OptionalComponentActionResult> {
  if (isBusyStatus(current.status) || current.status !== 'installed') {
    return { success: true, component: toInfo(definition.id, definition.displayName, current) }
  }

  try {
    if (await definition.healthCheck()) {
      return { success: true, component: toInfo(definition.id, definition.displayName, current) }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Logger.warn(`[OptionalComponents] healthCheck threw for "${definition.id}"`, error)
    await persistStatus(definition.id, { status: 'error', error: message })
    const failed = await readInfo(definition)
    return { success: false, error: message, component: failed }
  }

  await persistStatus(definition.id, { status: 'broken', error: 'health_check_failed' })
  const broken = await readInfo(definition)
  return { success: false, error: 'health_check_failed', component: broken }
}

async function performAction(
  definition: OptionalComponentDefinition,
  action: OptionalComponentAction
): Promise<OptionalComponentActionResult> {
  const current = await getComponentPersistedState(definition.id)

  if (isBusyStatus(current.status)) {
    return {
      success: false,
      error: 'another_operation_in_progress',
      component: toInfo(definition.id, definition.displayName, current)
    }
  }

  if (action === 'health_check') {
    return runHealthCheck(definition, current)
  }
  return runLifecycleOperation(definition, action, current)
}

/**
 * Run a lifecycle action for a whitelisted component.
 *
 * SECURITY: The renderer can only influence this call through the component
 * id and the action name; both must pass the whitelist checks here regardless
 * of any validation already done at the IPC boundary (defense in depth).
 */
export async function runOptionalComponentAction(
  componentId: string,
  action: OptionalComponentAction
): Promise<OptionalComponentActionResult> {
  const definition = getOptionalComponent(componentId)
  if (!definition || definition.id !== componentId) {
    throw new OptionalComponentNotFoundError(componentId)
  }

  if (inFlight.has(componentId)) {
    // Fail fast without waiting on the running operation; the persisted
    // snapshot already carries the transient busy status.
    const current = await getComponentPersistedState(componentId)
    return {
      success: false,
      error: 'another_operation_in_progress',
      component: toInfo(componentId, definition.displayName, current)
    }
  }

  const task = performAction(definition, action).finally(() => inFlight.delete(componentId))
  inFlight.set(componentId, task)
  return task
}

/** Snapshot of every registered component, sorted by id for stable UI order. */
export async function listOptionalComponentStates(): Promise<OptionalComponentInfo[]> {
  const states = await Promise.all(
    listOptionalComponents().map((definition) => readInfo(definition))
  )
  return states.sort((a, b) => a.id.localeCompare(b.id))
}

/** One component's snapshot; null when the id is not whitelisted. */
export async function getOptionalComponentState(
  componentId: string
): Promise<OptionalComponentInfo | null> {
  const definition = getOptionalComponent(componentId)
  if (!definition) return null
  return readInfo(definition)
}

/** Test-only helper to clear module-level singletons between test cases. */
export function resetOptionalComponentsManagerForTests(): void {
  inFlight.clear()
}
