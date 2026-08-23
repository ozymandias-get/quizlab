import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import {
  type DoclingPipelinePrefs,
  getPipelinePrefs,
  setPipelinePrefs
} from './doclingPipelineSettings.js'

let handlersRegistered = false

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
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return failure('invalid_input', 'patch must be an object')
      }
      const allowed = new Set([
        'doOcr',
        'ocrLang',
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
        'imagesScale',
        'doChartExtraction',
        'forceBackendText',
        'enableRemoteServices',
        'allowExternalPlugins',
        'documentTimeout',
        'numThreads',
        'device',
        'enableHeadingHierarchy',
        'ocrBatchSize',
        'layoutBatchSize',
        'tableBatchSize',
        'queueMaxSize'
      ])
      for (const k of Object.keys(patch)) {
        if (!allowed.has(k)) return failure('invalid_input', `Unknown key: ${k}`)
        const v = (patch as Record<string, unknown>)[k]
        const boolKeys = new Set([
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
        if (boolKeys.has(k) && typeof v !== 'boolean')
          return failure('invalid_input', `${k} must be boolean`)
        if (k === 'ocrLang' && typeof v !== 'string')
          return failure('invalid_input', `${k} must be string`)
        if (k === 'device' && typeof v !== 'string')
          return failure('invalid_input', `${k} must be string`)
        if (k === 'imagesScale' && typeof v !== 'number')
          return failure('invalid_input', `${k} must be number`)
        if (k === 'documentTimeout' && v !== null && typeof v !== 'number')
          return failure('invalid_input', `${k} must be number or null`)
        if (
          [
            'numThreads',
            'ocrBatchSize',
            'layoutBatchSize',
            'tableBatchSize',
            'queueMaxSize'
          ].includes(k) &&
          typeof v !== 'number'
        ) {
          return failure('invalid_input', `${k} must be number`)
        }
      }
      const next = await setPipelinePrefs(patch)
      return success(next)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
