import type {
  OptionalComponentAction,
  OptionalComponentInfo,
  OptionalComponentStatus
} from '../../../shared/types/index.js'

/**
 * A whitelisted optional component implementation. Definitions live only in
 * the Electron main process — they own filesystem/process side effects and are
 * never exposed to the renderer, which only ever sends the component id and a
 * lifecycle action name over typed IPC.
 */
export interface OptionalComponentDefinition {
  /** Stable identifier (lowercase kebab/snake). Acts as the IPC whitelist key. */
  readonly id: string
  readonly displayName: string
  /**
   * Version of the artifact this definition ships/installs. Persisted by the
   * manager after successful install/update; surfaced as null while absent.
   */
  readonly version: string

  install(): Promise<void>
  uninstall(): Promise<void>
  repair(): Promise<void>
  update(): Promise<void>

  /**
   * Verify an installed component is intact. Must not attempt repairs;
   * return false when the installation is damaged or incomplete.
   */
  healthCheck(): Promise<boolean>
}

/** Per-component record persisted in userData/components.json. */
export interface OptionalComponentPersistedState {
  status: OptionalComponentStatus
  version: string | null
  error: string | null
  updatedAt: number
}

export type OptionalComponentsFile = Record<string, OptionalComponentPersistedState>

/** Statuses that indicate a lifecycle operation is currently in flight. */
const BUSY_STATUSES: ReadonlySet<OptionalComponentStatus> = new Set([
  'installing',
  'uninstalling',
  'repairing',
  'updating'
])

export function isBusyStatus(status: OptionalComponentStatus): boolean {
  return BUSY_STATUSES.has(status)
}

/** Allowed source statuses per action. */
export const ACTION_ENTRY_STATUSES: Record<
  Exclude<OptionalComponentAction, 'health_check'>,
  readonly OptionalComponentStatus[]
> = {
  install: ['not_installed', 'broken', 'error'],
  uninstall: ['installed', 'broken', 'error'],
  repair: ['installed', 'broken', 'error'],
  update: ['installed']
}

/** Transient status persisted while the operation runs. */
export const ACTION_BUSY_STATUS: Record<
  Exclude<OptionalComponentAction, 'health_check'>,
  OptionalComponentStatus
> = {
  install: 'installing',
  uninstall: 'uninstalling',
  repair: 'repairing',
  update: 'updating'
}

/**
 * Terminal status persisted after an action succeeds. health_check keeps the
 * current status (or downgrades installed → broken) and is handled separately.
 */
export const ACTION_SUCCESS_STATUS: Record<
  Exclude<OptionalComponentAction, 'health_check'>,
  OptionalComponentStatus
> = {
  install: 'installed',
  uninstall: 'not_installed',
  repair: 'installed',
  update: 'installed'
}
