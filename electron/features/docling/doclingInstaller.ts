import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DoclingInstallPhase } from '../../../shared/types/index.js'
import { extractArchive, findFileNamed } from './doclingArchive.js'
import { downloadFile } from './doclingDownloader.js'
import {
  type DoclingInstallInfo,
  emptyManifest,
  patchDoclingManifest,
  readDoclingManifest
} from './doclingManifest.js'
import {
  type DoclingDirLayout,
  getDoclingLayout,
  getUvBinaryPath,
  getVenvPythonPath,
  KNOWN_COMPONENT_SUBDIRS,
  UV_BINARY_FILENAME
} from './doclingPaths.js'
import { runCommandChecked } from './doclingProcessRunner.js'
import {
  DOCLING_CORE_VERSION,
  DOCLING_PACKAGES,
  DOCLING_VERSION,
  getUvAssetKey,
  PYTHON_VERSION,
  UV_ASSETS,
  UV_VERSION
} from './doclingVersions.js'

/**
 * Transaction-like installer pipeline for the private Docling runtime.
 *
 * Guarantees:
 * - Every artifact is pinned in doclingVersions.ts and checksum-verified.
 * - Steps are idempotent (marker files), so repair/update re-run the same
 *   pipeline and only perform missing or outdated work.
 * - The manifest is flipped to "ready" only after verification succeeds; a
 *   crash or error at any stage leaves status "installing" plus the failing
 *   phase, and rethrows so the Optional Component Manager records an error.
 *   A half-finished install can therefore never look installed.
 */

/** Seam for tests: network + process execution are injected, fs is real. */
export interface DoclingInstallerIo {
  downloadAsset(
    url: string,
    destPath: string,
    expectedSha256: string,
    onBytes?: (received: number, total: number | null) => void
  ): Promise<void>
  exec(
    exe: string,
    args: string[],
    envOverrides?: Record<string, string>
  ): Promise<{ stdout: string }>
  extractArchive(archivePath: string, destDir: string): Promise<void>
}

export const defaultDoclingInstallerIo: DoclingInstallerIo = {
  async downloadAsset(url, destPath, expectedSha256, onBytes) {
    await downloadFile({ url, destPath, expectedSha256, onProgress: onBytes })
  },
  async exec(exe, args, envOverrides) {
    return runCommandChecked(exe, args, { envOverrides })
  },
  extractArchive
}

export interface DoclingProgressUpdate {
  phase: DoclingInstallPhase | 'failed'
  /** 0..100 when actually computable (downloads with known size), else null. */
  percent: number | null
  message?: string
}

export type ProgressReporter = (update: DoclingProgressUpdate) => void

function noopReporter(): void {}

interface PipelineContext {
  io: DoclingInstallerIo
  layout: DoclingDirLayout
  uvPath: string
  venvPythonPath: string
  packages: string[]
  report: ProgressReporter
}

function uvEnvOverrides(layout: DoclingDirLayout): Record<string, string> {
  return {
    // SECURITY: everything uv touches stays inside the component directory;
    // "only-managed" makes uv refuse system interpreters outright.
    UV_PYTHON_INSTALL_DIR: layout.runtime,
    UV_PYTHON_PREFERENCE: 'only-managed',
    UV_CACHE_DIR: path.join(layout.temp, 'uv-cache')
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function readMarker(markerPath: string): Promise<string | null> {
  try {
    return (await fs.readFile(markerPath, 'utf8')).trim()
  } catch {
    return null
  }
}

// --- pipeline steps ---------------------------------------------------------

const UV_MARKER = '.uv-version'
const PYTHON_MARKER = '.python-version'
/** Written once the venv exists; records the interpreter it was built for. */
const VENV_MARKER = '.venv-python'
/**
 * Written only after `uv pip install` succeeded; records the exact package
 * pins. Kept separate from VENV_MARKER so a crash between environment
 * creation and package installation is repaired by re-running just that part.
 */
const ENV_PIN_MARKER = '.docling-pin'

async function stepEnsureUvBinary(ctx: PipelineContext): Promise<void> {
  const { io, layout, report } = ctx
  const markerPath = path.join(layout.bin, UV_MARKER)

  if ((await readMarker(markerPath)) === UV_VERSION && (await exists(ctx.uvPath))) {
    return
  }

  const asset = UV_ASSETS[getUvAssetKey()]
  const archiveExt = asset.url.endsWith('.zip') ? 'zip' : 'tar.gz'
  const archivePath = path.join(layout.temp, `uv-${UV_VERSION}.${archiveExt}`)
  const extractDir = path.join(layout.temp, 'uv-extract')

  await io.downloadAsset(asset.url, archivePath, asset.sha256, (received, total) => {
    // Real percentage only — reported solely while the byte count is known.
    if (total && total > 0) {
      report({
        phase: 'downloading_runtime',
        percent: Math.min(100, Math.round((received / total) * 100)),
        message: 'uv binary'
      })
    }
  })

  await fs.mkdir(layout.bin, { recursive: true })
  await io.extractArchive(archivePath, extractDir)
  const found = await findFileNamed(extractDir, UV_BINARY_FILENAME)
  if (!found) {
    throw new Error(`uv binary "${UV_BINARY_FILENAME}" not found after extraction`)
  }
  if (process.platform !== 'win32') {
    await fs.chmod(found, 0o755).catch(() => {})
  }
  await fs.rename(found, ctx.uvPath)
  await fs.rm(extractDir, { recursive: true, force: true })
  await fs.rm(archivePath, { force: true })
  await fs.writeFile(markerPath, `${UV_VERSION}\n`, 'utf8')
}

async function stepEnsureManagedPython(ctx: PipelineContext): Promise<void> {
  const { io, layout } = ctx
  const markerPath = path.join(layout.runtime, PYTHON_MARKER)

  if ((await readMarker(markerPath)) === PYTHON_VERSION) {
    const listing = await fs.readdir(layout.runtime).catch(() => [])
    // A marker alone must not fake success after a wiped runtime directory.
    if (listing.length > 0) return
  }

  await io.exec(ctx.uvPath, ['python', 'install', PYTHON_VERSION], uvEnvOverrides(layout))
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, `${PYTHON_VERSION}\n`, 'utf8')
}

async function stepCreateEnvironment(ctx: PipelineContext): Promise<void> {
  const { io, layout } = ctx
  const venvMarker = path.join(layout.environment, VENV_MARKER)
  const pinMarker = path.join(layout.environment, ENV_PIN_MARKER)
  const expectedPin = `${DOCLING_VERSION}|${DOCLING_CORE_VERSION}`

  const venvReady =
    (await readMarker(venvMarker)) === PYTHON_VERSION && (await exists(ctx.venvPythonPath))
  const pinValue = await readMarker(pinMarker)

  // Fully healthy: venv matches this build's interpreter and package pins.
  if (venvReady && pinValue === expectedPin) return

  // Package-only mismatch (wrong pin value) means an update: recreate the
  // whole environment cleanly. A missing pin (crash between venv and pip)
  // reuses the existing venv and reinstalls packages only.
  if (venvReady && pinValue === null) return

  // Recreate from scratch when absent or version-pinned differently — this is
  // also what makes a later update() flow pick up bumped pins automatically.
  await fs.rm(layout.environment, { recursive: true, force: true })
  await io.exec(
    ctx.uvPath,
    ['venv', layout.environment, '--python', PYTHON_VERSION],
    uvEnvOverrides(layout)
  )
  if (!(await exists(ctx.venvPythonPath))) {
    throw new Error('Virtual environment was not created with the expected interpreter')
  }
  await fs.writeFile(venvMarker, `${PYTHON_VERSION}\n`, 'utf8')
}

async function stepInstallPackages(ctx: PipelineContext): Promise<void> {
  const { io, layout } = ctx
  const pinMarker = path.join(layout.environment, ENV_PIN_MARKER)
  const expectedPin = `${DOCLING_VERSION}|${DOCLING_CORE_VERSION}`

  if ((await readMarker(pinMarker)) === expectedPin) return

  await io.exec(
    ctx.uvPath,
    ['pip', 'install', '--python', ctx.venvPythonPath, ...DOCLING_PACKAGES],
    uvEnvOverrides(layout)
  )
  const freeze = await io.exec(
    ctx.uvPath,
    ['pip', 'freeze', '--python', ctx.venvPythonPath],
    uvEnvOverrides(layout)
  )
  ctx.packages = freeze.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (ctx.packages.length === 0) {
    throw new Error('Package freeze returned no installed packages')
  }
  await fs.writeFile(pinMarker, `${expectedPin}\n`, 'utf8')
}

/**
 * Model bytes are fetched by docling itself on first use (its documented
 * behaviour); this stage provisions the artifacts directory and hands its
 * location to the environment via DOCLING_ARTIFACTS_PATH at run time.
 */
async function stepPrepareModels(ctx: PipelineContext): Promise<void> {
  await fs.mkdir(ctx.layout.models, { recursive: true })
}

async function stepVerifyImport(ctx: PipelineContext): Promise<void> {
  const { io, layout } = ctx
  await io.exec(ctx.venvPythonPath, ['-c', 'import docling'], {
    DOCLING_ARTIFACTS_PATH: layout.models
  })
}

// --- pipeline driver --------------------------------------------------------

async function runStage(ctx: PipelineContext, phase: DoclingInstallPhase): Promise<void> {
  switch (phase) {
    case 'downloading_runtime':
      await stepEnsureUvBinary(ctx)
      await stepEnsureManagedPython(ctx)
      return
    case 'creating_environment':
      await stepCreateEnvironment(ctx)
      return
    case 'installing_docling':
      await stepInstallPackages(ctx)
      return
    case 'downloading_models':
      await stepPrepareModels(ctx)
      return
    case 'verifying':
      await stepVerifyImport(ctx)
      return
    default:
      throw new Error(`Unknown pipeline phase: ${phase}`)
  }
}

export interface RunPipelineOptions {
  componentsRoot?: string
  io?: Partial<DoclingInstallerIo>
  report?: ProgressReporter
}

/**
 * Run the install/repair/update pipeline. All three share one idempotent
 * sequence; they differ only in intent and in what was broken beforehand.
 */
export async function runDoclingPipeline(options: RunPipelineOptions = {}): Promise<void> {
  const { componentsRoot, io: ioOverrides, report = noopReporter } = options
  const io: DoclingInstallerIo = { ...defaultDoclingInstallerIo, ...ioOverrides }
  const layout = getDoclingLayout(componentsRoot)
  const venvPythonPath = getVenvPythonPath(layout)
  const ctx: PipelineContext = {
    io,
    layout,
    uvPath: getUvBinaryPath(layout),
    venvPythonPath,
    packages: [],
    report
  }

  try {
    report({ phase: 'preparing', percent: null })
    await patchDoclingManifest(layout, { status: 'installing', lastError: null })

    for (const phase of [
      'downloading_runtime',
      'creating_environment',
      'installing_docling',
      'downloading_models',
      'verifying'
    ] as const) {
      await patchDoclingManifest(layout, { lastPhase: phase })
      await runStage(ctx, phase)
    }

    const installInfo: DoclingInstallInfo = {
      completedAt: Date.now(),
      uvVersion: UV_VERSION,
      pythonVersion: PYTHON_VERSION,
      doclingVersion: DOCLING_VERSION,
      doclingCoreVersion: DOCLING_CORE_VERSION,
      packages: ctx.packages
    }
    await patchDoclingManifest(layout, {
      status: 'ready',
      lastPhase: 'completed',
      lastError: null,
      install: installInfo
    })
    report({ phase: 'completed', percent: 100 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await patchDoclingManifest(layout, { status: 'installing', lastError: message }).catch(() => {})
    report({ phase: 'failed', percent: null, message })
    throw error
  }
}

/** Remove every directory this component owns; foreign files are preserved. */
export async function removeDoclingComponentArtifacts(componentsRoot?: string): Promise<void> {
  const layout = getDoclingLayout(componentsRoot)
  for (const subdir of KNOWN_COMPONENT_SUBDIRS) {
    await fs.rm(path.join(layout.root, subdir), { recursive: true, force: true })
  }
  // Reset artifact metadata; lifecycle state in components.json is managed by
  // the Optional Component Manager.
  await patchDoclingManifest(layout, emptyManifest())
}

export interface DoclingHealthReport {
  healthy: boolean
  detail?: string
}

/**
 * Inspect an installed component without changing anything: manifest must be
 * "ready", uv and the venv interpreter must exist, and `import docling` must
 * succeed inside the private environment.
 */
export async function inspectDoclingInstallation(
  componentsRoot?: string,
  io: DoclingInstallerIo = defaultDoclingInstallerIo
): Promise<DoclingHealthReport> {
  const layout = getDoclingLayout(componentsRoot)
  const manifest = await readDoclingManifest(layout)
  if (manifest.status !== 'ready') {
    return { healthy: false, detail: `manifest status is "${manifest.status}"` }
  }

  const uvPath = getUvBinaryPath(layout)
  const venvPythonPath = getVenvPythonPath(layout)
  for (const [label, target] of [
    ['uv binary', uvPath],
    ['environment interpreter', venvPythonPath]
  ] as const) {
    if (!(await exists(target))) {
      return { healthy: false, detail: `${label} is missing` }
    }
  }

  try {
    await io.exec(venvPythonPath, ['-c', 'import docling'], {
      DOCLING_ARTIFACTS_PATH: layout.models
    })
  } catch (error) {
    return {
      healthy: false,
      detail: error instanceof Error ? error.message : 'import docling failed'
    }
  }
  return { healthy: true }
}
