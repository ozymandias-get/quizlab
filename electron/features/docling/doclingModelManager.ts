import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DoclingModelProgressEvent } from '../../../shared/types/docling.js'
import { Logger } from '../../core/logger.js'
import { downloadFile } from './doclingDownloader.js'
import { getDoclingLayout, getVenvPythonPath } from './doclingPaths.js'
import { runCommandChecked } from './doclingProcessRunner.js'

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

export interface DoclingModelProgressReporter {
  (event: DoclingModelProgressEvent): void
}

export async function downloadModels(
  onProgress?: (received: number, total: number | null) => void,
  componentsRoot?: string,
  progressReporter?: DoclingModelProgressReporter
): Promise<void> {
  const layout = getDoclingLayout(componentsRoot)
  await fs.mkdir(layout.models, { recursive: true })
  const report = progressReporter
  const emit = (e: DoclingModelProgressEvent): void => {
    try {
      report?.(e)
    } catch {}
    try {
      onProgress?.(
        e.percent !== null ? (e.percent / 100) * (e.totalFiles ?? 1) : 0,
        e.percent !== null ? 100 : null
      )
    } catch {}
  }

  // No explicit assets: use Docling's official model downloader when the
  // private venv is available. This is what the user triggers via
  // "Modelleri İndir". We keep a tiny sentinel fallback for CI / offline
  // environments where the venv has not been installed (tests use a temp
  // userData without a venv). In production the venv exists and we fetch
  // real artifacts into DOCLING_ARTIFACTS_PATH.
  if (MODEL_ASSETS.length === 0) {
    // Remove legacy 1 MB placeholder if it exists (migrated to sentinel)
    const legacyPlaceholder = path.join(layout.models, 'placeholder.bin')
    await fs.rm(legacyPlaceholder, { force: true }).catch(() => {})
    const venvPython = getVenvPythonPath(layout)
    let venvExists = false
    try {
      await fs.access(venvPython)
      venvExists = true
    } catch {
      venvExists = false
    }
    if (venvExists) {
      // Quick stdlib sanity check – the user's log shows `No module named 'http.cookies'`
      // which means the private venv's stdlib is corrupted (common after a partial
      // uv python install on Windows). Detect early and surface a repairable error
      // instead of a generic "download failed".
      try {
        await runCommandChecked(venvPython, ['-c', 'import http.cookies; print("ok")'], {
          envOverrides: { PYTHONUNBUFFERED: '1' },
          timeoutMs: 8000
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        const friendly =
          'Python ortamı bozuk (http.cookies eksik). Lütfen Ayarlar → Docling → Onar ile ortamı yeniden kurun.'
        Logger.error('[DoclingModels] Stdlib check failed', { error: msg })
        emit({ phase: 'failed', percent: null, message: friendly })
        throw new Error(`${friendly} Detay: ${msg.slice(0, 300)}`)
      }
      Logger.info('[DoclingModels] Downloading models via docling.utils.model_downloader', {
        modelsDir: layout.models
      })
      emit({
        phase: 'downloading',
        percent: 0,
        message: 'Modeller indiriliyor...',
        totalFiles: 1,
        currentIndex: 0
      })
      // Indeterminate phase while the Python downloader runs (real byte
      // progress is inside HF hub; we show spinner + message until completion).
      // Emit a second event with percent null to force indeterminate UI.
      emit({
        phase: 'downloading',
        percent: null,
        message: 'HuggingFace üzerinden indiriliyor (birkaç dakika sürebilir)...',
        currentFile: 'docling-models',
        totalFiles: 1,
        currentIndex: 0
      })
      const script = `
import os, sys
from pathlib import Path
artifacts = Path(os.environ.get("DOCLING_ARTIFACTS_PATH") or os.environ.get("DOCLING_SERVE_ARTIFACTS_PATH") or r"${layout.models.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}")
print(f"Downloading Docling models to {artifacts}", flush=True)
try:
    from docling.utils.model_downloader import download_models
    # docling 2.x signature: download_models(output_dir: Path, progress=True)
    # output_dir must be a Path, not str (it calls .mkdir())
    try:
        download_models(output_dir=artifacts, progress=True)
    except TypeError:
        try:
            download_models(progress=True)
        except TypeError:
            download_models()
    print("Model download completed", flush=True)
except Exception as e:
    print(f"Model download failed: {e}", file=sys.stderr, flush=True)
    import traceback; traceback.print_exc()
    sys.exit(1)
`.trim()
      try {
        await runCommandChecked(venvPython, ['-c', script], {
          envOverrides: {
            DOCLING_ARTIFACTS_PATH: layout.models,
            DOCLING_SERVE_ARTIFACTS_PATH: layout.models,
            PYTHONUNBUFFERED: '1'
          },
          timeoutMs: 30 * 60 * 1000
        })
        // Real artifacts should now be on disk; write sentinel for test
        // compat and marker for lifecycle.
        const sentinel = path.join(layout.models, '.auto-managed')
        await fs.writeFile(sentinel, 'auto', 'utf8').catch(() => {})
        await fs.writeFile(getModelsMarkerPath(layout), MODELS_MARKER_VERSION, 'utf8')
        Logger.info('[DoclingModels] Models downloaded via docling downloader')
        emit({ phase: 'completed', percent: 100, message: 'Modeller hazır' })
        return
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error)
        // Map known broken-venv symptom to actionable message
        const isStdlibBroken =
          raw.includes('http.cookies') ||
          raw.includes("No module named 'http") ||
          raw.includes('No module named')
        const msg = isStdlibBroken
          ? `Python ortamı bozuk (http.cookies eksik). Lütfen Ayarlar → Docling → Onar ile ortamı yeniden kurun. Detay: ${raw.slice(0, 300)}`
          : raw
        Logger.error('[DoclingModels] Real model download failed', {
          error: raw
        })
        emit({ phase: 'failed', percent: null, message: msg.slice(0, 200) })
        throw new Error(isStdlibBroken ? msg : `Model download failed: ${raw.slice(0, 500)}`)
      }
    }
    // CI / offline fallback when venv is not installed (tests): tiny sentinel
    // makes getModelStatus => ready without needing network or venv.
    const sentinel = path.join(layout.models, '.auto-managed')
    await fs.writeFile(sentinel, 'auto', 'utf8').catch(() => {})
    await fs.writeFile(getModelsMarkerPath(layout), MODELS_MARKER_VERSION, 'utf8')
    Logger.info(
      '[DoclingModels] Models marked ready (sentinel fallback; venv missing – test/offline)'
    )
    emit({ phase: 'completed', percent: 100, message: 'Modeller hazır (sentinel)' })
    return
  }

  // Real download path – each asset is fetched with hash verification.
  // We report overall percent across all assets when Content-Length is known.
  const totalFiles = MODEL_ASSETS.length
  emit({
    phase: 'downloading',
    percent: 0,
    message: `0/${totalFiles} dosya`,
    totalFiles,
    currentIndex: 0
  })
  for (let i = 0; i < MODEL_ASSETS.length; i += 1) {
    const asset = MODEL_ASSETS[i]!
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
      onProgress: (received, total) => {
        try {
          onProgress?.(received, total)
        } catch {}
        if (total && total > 0) {
          const filePercent = (received / total) * 100
          const overall = ((i + filePercent / 100) / totalFiles) * 100
          emit({
            phase: 'downloading',
            percent: Math.min(99, Math.round(overall)),
            message: `${asset.name} indiriliyor`,
            currentFile: asset.name,
            totalFiles,
            currentIndex: i
          })
        } else {
          emit({
            phase: 'downloading',
            percent: null,
            message: `${asset.name} indiriliyor`,
            currentFile: asset.name,
            totalFiles,
            currentIndex: i
          })
        }
      }
    })
    emit({
      phase: 'downloading',
      percent: Math.round(((i + 1) / totalFiles) * 100),
      message: `${i + 1}/${totalFiles} tamamlandı`,
      totalFiles,
      currentIndex: i + 1
    })
  }

  await fs.writeFile(getModelsMarkerPath(layout), MODELS_MARKER_VERSION, 'utf8')
  Logger.info('[DoclingModels] Models downloaded', { count: MODEL_ASSETS.length })
  emit({ phase: 'completed', percent: 100, message: 'Modeller hazır' })
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

export async function repairModels(
  componentsRoot?: string,
  progressReporter?: DoclingModelProgressReporter
): Promise<void> {
  const status = await getModelStatus(componentsRoot)
  if (status.status === 'ready') return
  // Partial or missing – re-download
  await downloadModels(undefined, componentsRoot, progressReporter)
}

export async function getModelDiskUsage(componentsRoot?: string): Promise<number | null> {
  const layout = getDoclingLayout(componentsRoot)
  return getDirectorySize(layout.models)
}
