import { failure, success } from '../../../shared/lib/typedIpc.js'
import type { DoclingPipelinePrefs } from '../../../shared/types/quizlabDocument.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import {
  getPipelinePrefs,
  PIPELINE_PREFS_DEFAULTS,
  setPipelinePrefs
} from './doclingPipelineSettings.js'

let handlersRegistered = false

const BOOL_KEYS = new Set([
  'doOcr',
  'forceFullPageOcr',
  'detectTables',
  'fastTables',
  'cellMatching',
  'doCodeEnrichment',
  'doFormulaEnrichment',
  'doPictureClassification',
  'doPictureDescription',
  'extractFigures',
  'generatePageImages',
  'generateTableImages',
  'doChartExtraction',
  'forceBackendText',
  'enableRemoteServices',
  'allowExternalPlugins',
  'enableHeadingHierarchy'
])

const NUMBER_KEYS = new Set<keyof DoclingPipelinePrefs>([
  'presetLevel',
  'numThreads',
  'ocrBatchSize',
  'layoutBatchSize',
  'tableBatchSize',
  'queueMaxSize',
  'imagesScale'
])

/**
 * Type-level gate for IPC input. Semantic range validation (min/max clamps)
 * lives in the shared limits used by `sanitize` – this handler only needs to
 * reject wrong-typed or unknown fields before they reach the sanitizer.
 */
export function validatePipelinePatch(patch: unknown): string | null {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return 'patch must be an object'
  for (const k of Object.keys(patch as Record<string, unknown>)) {
    if (!(k in PIPELINE_PREFS_DEFAULTS) && k !== 'updatedAt') return `Unknown key: ${k}`
    const v = (patch as Record<string, unknown>)[k]
    if (BOOL_KEYS.has(k as never) && typeof v !== 'boolean') return `${k} must be boolean`
    if (k === 'ocrLang' && typeof v !== 'string') return `${k} must be string`
    if (k === 'documentTimeout' && v !== null && typeof v !== 'number') {
      return `${k} must be number or null`
    }
    if (k === 'presetLevel' && v !== null && typeof v !== 'number') {
      return `${k} must be number or null`
    }
    if (
      NUMBER_KEYS.has(k as keyof DoclingPipelinePrefs) &&
      k !== 'presetLevel' &&
      typeof v !== 'number'
    ) {
      return `${k} must be number`
    }
  }
  return null
}

export function registerDoclingPipelineHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true
  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_PIPELINE_GET_PREFS,
    async () => {
      const prefs = await getPipelinePrefs()
      return success(prefs)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.DOCLING_PIPELINE_SET_PREFS,
    async (_event, patch: Partial<DoclingPipelinePrefs>) => {
      const invalid = validatePipelinePatch(patch)
      if (invalid) return failure('invalid_input', invalid)
      const next = await setPipelinePrefs(patch)
      return success(next)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
