import path from 'node:path'

import type { DoclingPipelinePrefs } from '@shared-core/types'

import { app } from 'electron'

import { ConfigManager as CM } from '../../core/ConfigManager.js'

export type { DoclingPipelinePrefs }

const DEFAULT_PREFS: DoclingPipelinePrefs = {
  doOcr: false,
  extractFigures: false,
  detectTables: true,
  fastTables: true
}

function getPipelineConfigPath(): string {
  return path.join(app.getPath('userData'), 'components', 'docling', 'pipeline.json')
}

let manager: CM<DoclingPipelinePrefs> | null = null
function getManager(): CM<DoclingPipelinePrefs> {
  if (!manager) manager = new CM<DoclingPipelinePrefs>(getPipelineConfigPath())
  return manager
}

export async function getPipelinePrefs(): Promise<DoclingPipelinePrefs> {
  const data = await getManager().read()
  return { ...DEFAULT_PREFS, ...data }
}

export async function setPipelinePrefs(
  patch: Partial<DoclingPipelinePrefs>
): Promise<DoclingPipelinePrefs> {
  const cur = await getPipelinePrefs()
  const next: DoclingPipelinePrefs = { ...cur, ...patch, updatedAt: Date.now() }
  // Strip unknown keys and keep only the 4 booleans + updatedAt
  const clean: DoclingPipelinePrefs = {
    doOcr: !!next.doOcr,
    extractFigures: !!next.extractFigures,
    detectTables: !!next.detectTables,
    fastTables: !!next.fastTables,
    updatedAt: next.updatedAt
  }
  await getManager().write(clean)
  return clean
}

export function pipelinePrefsHash(prefs: DoclingPipelinePrefs): string {
  // Stable short hash for cache key – order matters
  return `${prefs.doOcr ? 1 : 0}-${prefs.extractFigures ? 1 : 0}-${prefs.detectTables ? 1 : 0}-${prefs.fastTables ? 1 : 0}`
}

export function resetPipelineManagerForTests(): void {
  manager = null
}

export const PIPELINE_PREFS_DEFAULTS = DEFAULT_PREFS
