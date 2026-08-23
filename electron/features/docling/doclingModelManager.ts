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

// Model asset list – in production this holds pinned HuggingFace
// `ds4sd/docling-models` files with SHA256. When populated, downloadModels
// fetches each asset via HTTPS + hash verification. When empty the runtime
// relies on Docling's documented auto-download (first conversion lazily
// fetches artifacts to DOCLING_ARTIFACTS_PATH). The marker is still used
// so the lifecycle (ready/missing/partial) stays testable without
// downloading gigabytes in CI.
//
// To switch to explicit model pinning, populate e.g.:
//   { name: 'layout/model.safetensors',
//     url: 'https://huggingface.co/ds4sd/docling-models/resolve/<pin>/...',
//     sha256: '<64 hex>' }
// and remove the empty-list fast-path below.
export const MODEL_ASSETS: Array<{ name: string; url: string; sha256: string }> = []

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
    // Auto-managed mode still counts as ready via sentinel; marker alone
    // without files was the previous fast-path but sentinel now ensures files>0.
    // Keep the fast-path for backward compat (old installs without sentinel).
    if (MODEL_ASSETS.length === 0 && version === MODELS_MARKER_VERSION) {
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

  // No explicit assets: Docling will auto-download on first conversion.
  // Write a tiny sentinel so getModelStatus has a file to report and the
  // existing "partial when wrong version" test stays valid without a 1 MB
  // dummy. The sentinel is tiny and cleaned by deleteModels.
  if (MODEL_ASSETS.length === 0) {
    // Remove legacy 1 MB placeholder if it exists (migrated to sentinel)
    const legacyPlaceholder = path.join(layout.models, 'placeholder.bin')
    await fs.rm(legacyPlaceholder, { force: true }).catch(() => {})
    const sentinel = path.join(layout.models, '.auto-managed')
    await fs.writeFile(sentinel, 'auto', 'utf8').catch(() => {})
    await fs.writeFile(getModelsMarkerPath(layout), MODELS_MARKER_VERSION, 'utf8')
    Logger.info(
      '[DoclingModels] Models marked ready (auto-download; no explicit MODEL_ASSETS configured)'
    )
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
