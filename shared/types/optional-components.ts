/**
 * Optional Component Manager — shared contract types.
 *
 * Optional components are app-level features (e.g. the Docling-based Smart
 * Reader) that users can install, update, repair or remove on demand. The
 * lifecycle runs exclusively in the Electron main process; the renderer only
 * ever sees these serializable payloads over typed IPC.
 */

/** Lifecycle states persisted per component in the main process store. */
export const OPTIONAL_COMPONENT_STATUSES = [
  'not_installed',
  'installing',
  'installed',
  'updating',
  'repairing',
  'uninstalling',
  'broken',
  'error'
] as const

export type OptionalComponentStatus = (typeof OPTIONAL_COMPONENT_STATUSES)[number]

/** User-triggerable lifecycle actions exposed over IPC. */
export const OPTIONAL_COMPONENT_ACTIONS = [
  'install',
  'uninstall',
  'repair',
  'update',
  'health_check'
] as const

export type OptionalComponentAction = (typeof OPTIONAL_COMPONENT_ACTIONS)[number]

/**
 * Serializable snapshot of one component, merged from its static definition
 * (registry whitelist) and its persisted state (userData/components.json).
 */
export interface OptionalComponentInfo {
  id: string
  displayName: string
  /** Installed version; null when not installed or unknown. */
  version: string | null
  installed: boolean
  status: OptionalComponentStatus
  /** Last failure message; only meaningful for the error/broken statuses. */
  error: string | null
  updatedAt: number
}

/**
 * Result of a lifecycle action. Transport-level problems (unknown component,
 * invalid transition) surface as IPC failures; domain-level failures (e.g.
 * a download error during install) are reported here with success:false so
 * the renderer always receives the resulting component state back.
 */
export interface OptionalComponentActionResult {
  success: boolean
  error?: string
  component: OptionalComponentInfo
}
