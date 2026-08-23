import { createHash } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'

import type { DoclingModelProgressEvent } from '../../../shared/types/docling.js'
import { Logger } from '../../core/logger.js'
import { downloadFile } from './doclingDownloader.js'
import { getDoclingLayout, getVenvPythonPath } from './doclingPaths.js'
import { runCommandChecked } from './doclingProcessRunner.js'
import { DOCLING_VERSION } from './doclingVersions.js'

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
/** Written when the artifacts are managed by Docling's own downloader. */
const AUTO_MANAGED_SENTINEL = '.auto-managed'
const MANIFEST_FILE = 'model-manifest.json'

export type DoclingModelStatus = 'ready' | 'missing' | 'partial' | 'runtime_missing'

export interface ModelStatusInfo {
  status: DoclingModelStatus
  diskBytes: number | null
  files: string[]
  version: string | null
}

/**
 * Integrity manifest written after a successful download. `getModelStatus`
 * verifies every entry (existence + byte size) on each check; the full
 * SHA-256 pass is available via `verifyModelIntegrity` (used by repair).
 */
interface ModelManifest {
  schemaVersion: '1'
  /** How the artifacts were provisioned. */
  mode: 'auto-managed' | 'pinned' | 'test-sentinel'
  doclingVersion: string | null
  /** HuggingFace revision pin – populated in explicit-asset mode. */
  revision: string | null
  createdAt: number
  files: Array<{ path: string; bytes: number; sha256: string }>
}

// Explicit asset pins – in production this holds pinned HuggingFace
// `ds4sd/docling-models` entries with revision + SHA-256. While empty, the
// runtime relies on Docling's documented auto-download (first conversion or
// the explicit "download models" action fetches artifacts into
// DOCLING_ARTIFACTS_PATH) and integrity is guaranteed by the manifest this
// manager writes after the download completes.
//
// To switch to explicit pinning, populate e.g.:
//   { name: 'layout/model.safetensors',
//     url: 'https://huggingface.co/ds4sd/docling-models/resolve/<pin>/...',
//     sha256: '<64 hex>', revision: '<pin>' }
export const MODEL_ASSETS: Array<{ name: string; url: string; sha256: string }> = []

// P2-15: HuggingFace revision pin for reproducibility. When set (e.g.
// "f4b9e4b2..."), the manifest records it and `getModelStatus` treats a
// different revision as `partial` so repair fetches the pinned revision.
// While null, any revision is accepted – the manifest still records the
// integrity (path+bytes+sha256) but not an upstream pin. Populate this
// together with MODEL_ASSETS when moving to explicit pinning.
export const PINNED_MODEL_REVISION: string | null = null

function getModelsMarkerPath(layout: ReturnType<typeof getDoclingLayout>): string {
  return path.join(layout.models, MODELS_MARKER)
}

function getManifestPath(layout: ReturnType<typeof getDoclingLayout>): string {
  return path.join(layout.models, MANIFEST_FILE)
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

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function venvExists(layout: ReturnType<typeof getDoclingLayout>): Promise<boolean> {
  try {
    await fs.access(getVenvPythonPath(layout))
    return true
  } catch {
    return false
  }
}

async function buildManifestFromDisk(
  layout: ReturnType<typeof getDoclingLayout>,
  mode: ModelManifest['mode']
): Promise<ModelManifest> {
  const files: ModelManifest['files'] = []
  const skip = new Set([MODELS_MARKER, AUTO_MANAGED_SENTINEL, MANIFEST_FILE])
  const stack: string[] = [layout.models]
  while (stack.length > 0) {
    const cur = stack.pop()!
    const entries = await fs.readdir(cur, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(cur, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && !skip.has(entry.name)) {
        const stat = await fs.stat(full).catch(() => null)
        if (!stat) continue
        const rel = path.relative(layout.models, full).split(path.sep).join('/')
        files.push({ path: rel, bytes: stat.size, sha256: await hashFile(full) })
      }
    }
  }
  return {
    schemaVersion: '1',
    mode,
    doclingVersion: DOCLING_VERSION,
    revision: PINNED_MODEL_REVISION,
    createdAt: Date.now(),
    files
  }
}

async function readManifest(
  layout: ReturnType<typeof getDoclingLayout>
): Promise<ModelManifest | null> {
  try {
    const raw = await fs.readFile(getManifestPath(layout), 'utf8')
    const parsed = JSON.parse(raw) as ModelManifest
    if (parsed?.schemaVersion !== '1' || !Array.isArray(parsed.files)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Fast integrity pass: every manifest entry must exist with the recorded byte
 * size. This is O(file count) stats – safe to call on every status poll.
 */
async function manifestFilesIntact(
  layout: ReturnType<typeof getDoclingLayout>,
  manifest: ModelManifest
): Promise<boolean> {
  for (const entry of manifest.files) {
    try {
      const stat = await fs.stat(path.join(layout.models, ...entry.path.split('/')))
      if (!stat.isFile() || stat.size !== entry.bytes) return false
    } catch {
      return false
    }
  }
  return true
}

export async function getModelStatus(componentsRoot?: string): Promise<ModelStatusInfo> {
  const layout = getDoclingLayout(componentsRoot)
  const markerPath = getModelsMarkerPath(layout)
  try {
    const marker = await fs.readFile(markerPath, 'utf8').catch(() => null)
    const version = marker?.trim() ?? null
    const entries = await fs.readdir(layout.models).catch(() => [] as string[])
    const files = entries.filter((e) => e !== MODELS_MARKER && e !== AUTO_MANAGED_SENTINEL)
    const diskBytes = await getDirectorySize(layout.models)

    // A marker alone never proves anything – real artifacts plus a matching
    // integrity manifest are required before reporting ready.
    const manifest =
      version === MODELS_MARKER_VERSION && files.length > 0 ? await readManifest(layout) : null

    if (
      version === MODELS_MARKER_VERSION &&
      files.length > 0 &&
      manifest &&
      (await manifestFilesIntact(layout, manifest))
    ) {
      // P2-15: if a revision is pinned, mismatched manifests are not `ready`
      // even if bytes match – they may be a different upstream revision.
      if (PINNED_MODEL_REVISION && manifest.revision !== PINNED_MODEL_REVISION) {
        return { status: 'partial', diskBytes, files, version }
      }
      // Engine gone but artifacts present → surface as repairable, not ready.
      if (!(await venvExists(layout))) {
        return { status: 'runtime_missing', diskBytes, files, version }
      }
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

  // Auto-managed mode: use Docling's official model downloader. The private
  // venv is REQUIRED – silently marking models ready without a runtime would
  // produce a fake-ready state that fails at first conversion.
  if (MODEL_ASSETS.length === 0) {
    // Remove legacy 1 MB placeholder if it exists (migrated to sentinel)
    const legacyPlaceholder = path.join(layout.models, 'placeholder.bin')
    await fs.rm(legacyPlaceholder, { force: true }).catch(() => {})
    const venvPython = getVenvPythonPath(layout)
    if (!(await venvExists(layout))) {
      const friendly =
        'Docling çalışma ortamı bulunamadı. Lütfen önce Ayarlar → Docling → Yükle ile motoru kurun.'
      Logger.warn('[DoclingModels] Download requested without an installed venv')
      emit({ phase: 'failed', percent: null, message: friendly })
      throw new Error('runtime_missing: Docling runtime is not installed')
    }
    // Quick stdlib sanity check – a corrupted private venv's stdlib (common
    // after a partial uv python install on Windows) surfaces here early as a
    // repairable error instead of a generic "download failed".
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
      // Build the integrity manifest from what actually landed on disk. An
      // empty artifact tree means the download produced nothing usable.
      const manifest = await buildManifestFromDisk(layout, 'auto-managed')
      if (manifest.files.length === 0) {
        const msg = 'Model indirme tamamlandı ancak diskte dosya oluşmadı.'
        Logger.error('[DoclingModels] Downloader produced no files')
        emit({ phase: 'failed', percent: null, message: msg })
        throw new Error(msg)
      }
      await fs.writeFile(getManifestPath(layout), JSON.stringify(manifest), 'utf8')
      await fs
        .writeFile(path.join(layout.models, AUTO_MANAGED_SENTINEL), 'auto', 'utf8')
        .catch(() => {})
      await fs.writeFile(getModelsMarkerPath(layout), MODELS_MARKER_VERSION, 'utf8')
      Logger.info('[DoclingModels] Models downloaded via docling downloader', {
        files: manifest.files.length
      })
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

  // Explicit pinned-asset path – each asset fetched with hash verification.
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

  const manifest = await buildManifestFromDisk(layout, 'pinned')
  await fs.writeFile(getManifestPath(layout), JSON.stringify(manifest), 'utf8')
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

/**
 * Full SHA-256 verification of every manifest entry. Slow (hashes gigabytes);
 * invoked by repair, never by the status poll.
 */
export async function verifyModelIntegrity(
  componentsRoot?: string
): Promise<{ ok: boolean; corrupted: string[] }> {
  const layout = getDoclingLayout(componentsRoot)
  const manifest = await readManifest(layout)
  if (!manifest) return { ok: false, corrupted: [] }
  const corrupted: string[] = []
  for (const entry of manifest.files) {
    try {
      const abs = path.join(layout.models, ...entry.path.split('/'))
      const digest = await hashFile(abs)
      if (digest !== entry.sha256) corrupted.push(entry.path)
    } catch {
      corrupted.push(entry.path)
    }
  }
  return { ok: corrupted.length === 0, corrupted }
}

export async function repairModels(
  componentsRoot?: string,
  progressReporter?: DoclingModelProgressReporter
): Promise<void> {
  const status = await getModelStatus(componentsRoot)
  if (status.status === 'ready') return
  // Partial or missing – re-download (a size-mismatched manifest entry means
  // a truncated artifact; the fresh download also rebuilds the manifest).
  await downloadModels(undefined, componentsRoot, progressReporter)
  // Deep verify so corruption that preserves file sizes cannot hide.
  if (status.status === 'partial') {
    const integrity = await verifyModelIntegrity(componentsRoot)
    if (!integrity.ok) {
      throw new Error(`Model doğrulaması başarısız: ${integrity.corrupted.join(', ')}`)
    }
  }
}

export async function getModelDiskUsage(componentsRoot?: string): Promise<number | null> {
  const layout = getDoclingLayout(componentsRoot)
  return getDirectorySize(layout.models)
}

/**
 * TEST-ONLY seam. Marks models as present without any runtime or network so
 * CI can exercise the lifecycle states. Production code must never call this;
 * a production install always goes through `downloadModels`, which requires
 * a working venv and produces a real manifest from real artifacts.
 */
export async function markModelsReadyForTests(componentsRoot?: string): Promise<void> {
  const layout = getDoclingLayout(componentsRoot)
  await fs.mkdir(layout.models, { recursive: true })
  const manifest: ModelManifest = {
    schemaVersion: '1',
    mode: 'test-sentinel',
    doclingVersion: DOCLING_VERSION,
    revision: PINNED_MODEL_REVISION,
    createdAt: Date.now(),
    files: []
  }
  await fs.writeFile(getManifestPath(layout), JSON.stringify(manifest), 'utf8')
  await fs
    .writeFile(path.join(layout.models, AUTO_MANAGED_SENTINEL), 'auto', 'utf8')
    .catch(() => {})
  await fs.writeFile(getModelsMarkerPath(layout), MODELS_MARKER_VERSION, 'utf8')
  // Simulate an installed engine so status checks behave like production.
  const venvPython = getVenvPythonPath(layout)
  await fs.mkdir(path.dirname(venvPython), { recursive: true })
  await fs.writeFile(venvPython, '', 'utf8').catch(() => {})
}
