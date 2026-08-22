/**
 * Docling Smart Reader — shared event contract types.
 *
 * The installer runs entirely in the Electron main process and reports
 * progress to the renderer as a stream of serializable events over typed IPC.
 */

/**
 * Ordered install pipeline stages. `percent` is only ever reported when the
 * underlying byte count is actually known (downloads with a Content-Length);
 * no synthetic progress is ever produced for instant stages.
 */
export const DOCLING_INSTALL_PHASES = [
  'preparing',
  'downloading_runtime',
  'creating_environment',
  'installing_docling',
  'downloading_models',
  'verifying',
  'completed'
] as const

export type DoclingInstallPhase = (typeof DOCLING_INSTALL_PHASES)[number]

export interface DoclingInstallProgressEvent {
  componentId: string
  phase: DoclingInstallPhase | 'failed'
  /** 0..100 when meaningfully computable, otherwise null. */
  percent: number | null
  message?: string
}

export type DoclingServiceState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export interface DoclingServiceStatus {
  state: DoclingServiceState
  installed: boolean
  port: number | null
  pid: number | null
  uptimeMs: number | null
  lastError: string | null
  healthy: boolean
  diskUsageBytes: number | null
  modelStatus: 'ready' | 'missing' | 'unknown'
}
