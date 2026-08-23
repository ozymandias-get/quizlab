import { promises as fs } from 'node:fs'
import path from 'node:path'

import { Logger } from '../../core/logger.js'
import { downloadFile } from './doclingDownloader.js'
import { getDoclingLayout } from './doclingPaths.js'

/**
 * Model lifecycle separated from the engine runtime.
 *
 * Engine: uv + venv + docling package (small, ~100 MB)
 * Models: large artifact files under models/ (several GB, optional to delete)
 *
 * This manager keeps the two concerns distinct so the user can purge models
 * without reinstalling the engine, and the installer can leave models empty
 * until the user explicitly requests them.
 */

export const MODELS_VERSION = '1'
const MODELS_MARKER = '.models-ready'
const MODELS_MARKER_VERSION = '1'

export type DoclingModelStatus = 'ready' | 'missing' | 'partial'

export interface ModelStatusInfo {
  status: DoclingModelStatus
  diskBytes: number | null
  files: string[]
  version: string | null
}

// Placeholder model asset list – in production these would be the real
// HuggingFace `ds4sd/docling-models` files with pinned SHA256.
// For now we track a single marker as the source of truth; the download
// path is fully wired for real URLs and hash verification.
// MERGE NOTE: Before production rollout, populate with pinned HF URLs +
// SHA256 and remove the placeholder.bin path so downloadModels fetches
// real artifacts. See branch report "REMAINING RISKS / MODEL_ASSETS".
const MODEL_ASSETS: Array<{ name: string; url: string; sha256: string }> = []

function getModelsMarkerPath(layout: ReturnType<typeof getDoclingLayout>): string {
  return path.join(layout.models, MODELS_MARKER)
}

async function getDirectorySize(dir: string): Promise<number | null> {
  try {
    let total = 0
    const stack: string[] = [dir]
    while (stack.length > 0) {
      const cur = stack.pop()!
      const entries = await fs.readdir(cur, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(cur, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else if (entry.isFile()) {
          try {
            const stat = await fs.stat(full)
            total += stat.size
          } catch {}
        }
      }
    }
    return total
  } catch {
    return null
  }
}

export async function getModelStatus(componentsRoot?: string): Promise<ModelStatusInfo> {
  const layout = getDoclingLayout(componentsRoot)
  const markerPath = getModelsMarkerPath(layout)
  try {
    const marker = await fs.readFile(markerPath, 'utf8').catch(() => null)
    const version = marker?.trim() ?? null
    const entries = await fs.readdir(layout.models).catch(() => [] as string[])
    const files = entries.filter((e) => e !== MODELS_MARKER)
    const diskBytes = await getDirectorySize(layout.models)
    if (version === MODELS_MARKER_VERSION && files.length > 0) {
      return { status: 'ready', diskBytes, files, version }
    }
    if (files.length > 0 && version !== MODELS_MARKER_VERSION) {
      return { status: 'partial', diskBytes, files, version }
    }
    if (files.length > 0) {
      return { status: 'partial', diskBytes, files, version }
    }
    return { status: 'missing', diskBytes: diskBytes ?? 0, files: [], version }
  } catch {
    return { status: 'missing', diskBytes: null, files: [], version: null }
  }
}

export async function downloadModels(
  onProgress?: (received: number, total: number | null) => void,
  componentsRoot?: string
): Promise<void> {
  const layout = getDoclingLayout(componentsRoot)
  await fs.mkdir(layout.models, { recursive: true })

  // If no real assets are configured, we still mark the models as ready
  // by writing the version marker – this keeps the flow testable without
  // downloading gigabytes in CI. Real deployments populate MODEL_ASSETS.
  if (MODEL_ASSETS.length === 0) {
    // Simulate a small model file for disk usage visibility
    const placeholder = path.join(layout.models, 'placeholder.bin')
    try {
      await fs.access(placeholder)
    } catch {
      await fs.writeFile(placeholder, Buffer.alloc(1024 * 1024, 0)) // 1 MB dummy
    }
    await fs.writeFile(getModelsMarkerPath(layout), MODELS_MARKER_VERSION, 'utf8')
    Logger.info('[DoclingModels] Models marked ready (placeholder, no remote assets configured)')
    return
  }

  // Real download path – each asset is fetched with hash verification
  for (const asset of MODEL_ASSETS) {
    const dest = path.join(layout.models, asset.name)
    // Skip if already present and hash matches (defensive – downloadFile will re-verify)
    try {
      await fs.access(dest)
      // Could verify hash here, but downloadFile will overwrite atomically if needed
    } catch {}
    await downloadFile({
      url: asset.url,
      destPath: dest,
      expectedSha256: asset.sha256,
      onProgress
    })
  }

  await fs.writeFile(getModelsMarkerPath(layout), MODELS_MARKER_VERSION, 'utf8')
  Logger.info('[DoclingModels] Models downloaded', { count: MODEL_ASSETS.length })
}

export async function deleteModels(componentsRoot?: string): Promise<void> {
  const layout = getDoclingLayout(componentsRoot)
  try {
    const entries = await fs.readdir(layout.models).catch(() => [] as string[])
    for (const entry of entries) {
      await fs.rm(path.join(layout.models, entry), { recursive: true, force: true })
    }
    // Keep the models directory itself, just empty
    await fs.mkdir(layout.models, { recursive: true })
    Logger.info('[DoclingModels] Models deleted')
  } catch (error) {
    Logger.warn('[DoclingModels] Delete failed', { error: String(error) })
    throw error
  }
}

export async function repairModels(componentsRoot?: string): Promise<void> {
  const status = await getModelStatus(componentsRoot)
  if (status.status === 'ready') return
  // Partial or missing – re-download
  await downloadModels(undefined, componentsRoot)
}

export async function getModelDiskUsage(componentsRoot?: string): Promise<number | null> {
  const layout = getDoclingLayout(componentsRoot)
  return getDirectorySize(layout.models)
}
