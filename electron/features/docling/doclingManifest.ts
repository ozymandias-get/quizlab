import type { DoclingInstallPhase } from '../../../shared/types/index.js'
import { ConfigManager } from '../../core/ConfigManager.js'
import type { DoclingDirLayout } from './doclingPaths.js'

/**
 * Installer metadata persisted at components/docling/component.json.
 * This is the artifact-level manifest; lifecycle state (installed/error for
 * the Optional Component Manager) lives in userData/components.json and is
 * only flipped to installed after a pipeline run completes successfully.
 */

export interface DoclingInstallInfo {
  completedAt: number
  uvVersion: string
  pythonVersion: string
  doclingVersion: string
  doclingCoreVersion: string
  /** `uv pip freeze` snapshot captured after a successful install. */
  packages: string[]
}

export interface DoclingManifest {
  schemaVersion: 1
  status: 'absent' | 'installing' | 'ready' | 'broken'
  lastPhase: DoclingInstallPhase | null
  lastError: string | null
  install: DoclingInstallInfo | null
  updatedAt: number
}

export function emptyManifest(): DoclingManifest {
  return {
    schemaVersion: 1,
    status: 'absent',
    lastPhase: null,
    lastError: null,
    install: null,
    updatedAt: 0
  }
}

export async function readDoclingManifest(layout: DoclingDirLayout): Promise<DoclingManifest> {
  const manager = new ConfigManager<DoclingManifest>(layout.manifestFile)
  const stored = await manager.read()
  if (!stored || stored.schemaVersion !== 1) return emptyManifest()
  return stored
}

/** Merge-patch and persist the manifest atomically. */
export async function patchDoclingManifest(
  layout: DoclingDirLayout,
  patch: Partial<Omit<DoclingManifest, 'updatedAt'>>
): Promise<DoclingManifest> {
  const manager = new ConfigManager<DoclingManifest>(layout.manifestFile)
  await manager.update((current) => ({
    ...emptyManifest(),
    ...current,
    ...patch,
    updatedAt: Date.now()
  }))
  const updated = await manager.read()
  return updated
}
