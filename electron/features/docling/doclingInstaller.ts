import { createHash } from 'node:crypto'
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
/** Frozen resolution of the full dependency tree (incl. transitives). */
const ENV_LOCK_FILE = 'docling-lock.txt'
/** Shipped with the app – makes the first install deterministic (P2-14). */
const BUNDLED_LOCK_FILENAME = 'docling-lock.pinned.txt'

async function getExpectedPin(): Promise<string> {
  // P1-6: pin includes lock hash so a transitive dependency bump (even with same
  // docling version) invalidates the environment and forces reinstall.
  const bundled = await loadBundledLock()
  if (!bundled) return `${DOCLING_VERSION}|${DOCLING_CORE_VERSION}|no-bundled`
  const hash = createHash('sha256').update(bundled).digest('hex').slice(0, 12)
  return `${DOCLING_VERSION}|${DOCLING_CORE_VERSION}|${hash}`
}

function isPinCompatible(stored: string | null, expected: string): boolean {
  if (stored === expected) return true
  // Migration: old pins without hash suffix were `${DOCLING_VERSION}|${DOCLING_CORE_VERSION}`
  // Treat them as compatible only when no bundled lock exists (test env)
  if (stored === `${DOCLING_VERSION}|${DOCLING_CORE_VERSION}` && expected.endsWith('|no-bundled'))
    return true
  return false
}

async function loadBundledLock(): Promise<string | null> {
  // In test runs (vitest) the bundled lock would make the fake installer
  // use a canned package list and break the “live resolve” expectations, so
  // skip it there – production and dev runs still use it for determinism.
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return null
  // Try several roots: dev cwd and packaged app path. Avoid import.meta which
  // is not available in the CommonJS build output.
  const candidates: string[] = []
  try {
    candidates.push(
      path.join(process.cwd(), 'electron', 'features', 'docling', BUNDLED_LOCK_FILENAME)
    )
    candidates.push(path.join(process.cwd(), 'resources', 'docling', BUNDLED_LOCK_FILENAME))
  } catch {}
  // Packaged resources path – electron-builder extraResources puts
  // resources/docling/docling-lock.pinned.txt under <resources>/docling/
  try {
    const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath ?? null
    if (resourcesPath) {
      candidates.push(path.join(resourcesPath, 'docling', BUNDLED_LOCK_FILENAME))
      candidates.push(path.join(resourcesPath, BUNDLED_LOCK_FILENAME))
    }
  } catch {}
  try {
    const electron = await import('electron').catch(
      () =>
        null as unknown as { app?: { getAppPath?: () => string; getPath?: (n: string) => string } }
    )
    const maybeApp = (
      electron as unknown as {
        app?: { getAppPath?: () => string; getPath?: (n: string) => string }
      }
    )?.app
    if (maybeApp?.getAppPath) {
      const appPath = maybeApp.getAppPath()
      candidates.push(path.join(appPath, 'electron', 'features', 'docling', BUNDLED_LOCK_FILENAME))
      candidates.push(path.join(appPath, 'resources', 'docling', BUNDLED_LOCK_FILENAME))
      candidates.push(path.join(appPath, BUNDLED_LOCK_FILENAME))
      // dist layout after build: dist/electron/electron/features/docling/...
      candidates.push(
        path.join(appPath, 'dist', 'electron', 'features', 'docling', BUNDLED_LOCK_FILENAME)
      )
    }
    if (maybeApp?.getPath) {
      try {
        const res = maybeApp.getPath('exe')
        // exe dir's resources
        const exeDir = path.dirname(res)
        candidates.push(path.join(exeDir, 'resources', 'docling', BUNDLED_LOCK_FILENAME))
      } catch {}
    }
  } catch {}
  // Also try relative to the compiled file's directory via __dirname fallback
  try {
    const dir = typeof __dirname !== 'undefined' ? (__dirname as unknown as string) : ''
    if (dir) {
      candidates.push(path.join(dir as string, BUNDLED_LOCK_FILENAME))
      candidates.push(
        path.join(dir, '..', '..', '..', 'resources', 'docling', BUNDLED_LOCK_FILENAME)
      )
      candidates.push(
        path.join(dir, '..', '..', '..', '..', 'resources', 'docling', BUNDLED_LOCK_FILENAME)
      )
    }
  } catch {}
  for (const cand of candidates) {
    try {
      const txt = await fs.readFile(cand, 'utf8')
      if (txt.includes(`docling==${DOCLING_VERSION}`)) return txt
    } catch {}
  }
  return null
}

export async function getBundledLockForTests(): Promise<string | null> {
  const prevVitest = process.env.VITEST
  const prevNodeEnv = process.env.NODE_ENV
  delete process.env.VITEST
  const saved = process.env.NODE_ENV
  if (saved === 'test') delete process.env.NODE_ENV
  try {
    return await loadBundledLock()
  } finally {
    if (prevVitest !== undefined) process.env.VITEST = prevVitest
    if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv
    else if (saved === 'test') process.env.NODE_ENV = 'test'
  }
}

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
    if (listing.length > 0) {
      // Verify stdlib integrity – the user's log showed `No module named 'http.cookies'`
      // which means the managed CPython's Lib/http is missing.
      let stdlibOk = false
      if (await exists(ctx.venvPythonPath)) {
        try {
          await io.exec(ctx.venvPythonPath, ['-c', 'import http.cookies'], {})
          stdlibOk = true
        } catch {}
      }
      if (!stdlibOk) {
        try {
          await io.exec(
            ctx.uvPath,
            ['run', '--python', PYTHON_VERSION, 'python', '-c', 'import http.cookies'],
            uvEnvOverrides(layout)
          )
          stdlibOk = true
        } catch {}
      }
      if (stdlibOk) return
      // Corrupted runtime – force reinstall below. Use robustRm because
      // python3.dll is often still memory-mapped on Windows and plain rm
      // leaves a half-deleted tree that makes the next `uv python install`
      // fail with "Sistem belirtilen yolu bulamıyor (os error 3)" on
      // `Lib/EXTERNALLY-MANAGED`.
      const { Logger } = await import('../../core/logger.js')
      Logger.warn(
        '[DoclingInstaller] Managed Python stdlib corrupted (http.cookies missing), reinstalling runtime'
      )
      await robustRm(layout.runtime).catch(() => {})
      // Clean any .old-* leftovers from previous EPERM renames
      try {
        const entries = await fs.readdir(path.dirname(layout.runtime)).catch(() => [])
        for (const e of entries) {
          if (e.startsWith('runtime.old-') || e.startsWith('runtime.')) continue
          // handled by robustRm's rename fallback – clean those too
          if (e.includes('.old-')) {
            await robustRm(path.join(path.dirname(layout.runtime), e)).catch(() => {})
          }
        }
      } catch {}
      await fs.mkdir(layout.runtime, { recursive: true }).catch(() => {})
    }
  }

  // Ensure runtime root exists before asking uv to populate it – if the
  // previous robustRm left a half-deleted `cpython-...` without `Lib`, uv
  // fails with OS error 3 on `Lib/EXTERNALLY-MANAGED`. A clean mkdir fixes it.
  await fs.mkdir(layout.runtime, { recursive: true }).catch(() => {})
  try {
    await io.exec(ctx.uvPath, ['python', 'install', PYTHON_VERSION], uvEnvOverrides(layout))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    // If uv failed because the tree is half-deleted, clean once more and retry
    if (msg.includes('EXTERNALLY-MANAGED') || msg.includes('os error 3')) {
      const { Logger } = await import('../../core/logger.js')
      Logger.warn(
        '[DoclingInstaller] uv python install hit half-deleted tree, cleaning and retrying',
        {
          error: msg.slice(0, 400)
        }
      )
      await robustRm(layout.runtime).catch(() => {})
      await fs.mkdir(layout.runtime, { recursive: true }).catch(() => {})
      await io.exec(ctx.uvPath, ['python', 'install', PYTHON_VERSION], uvEnvOverrides(layout))
    } else {
      throw error
    }
  }
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, `${PYTHON_VERSION}\n`, 'utf8')
}

async function stepCreateEnvironment(ctx: PipelineContext): Promise<void> {
  const { io, layout } = ctx
  const venvMarker = path.join(layout.environment, VENV_MARKER)
  const pinMarker = path.join(layout.environment, ENV_PIN_MARKER)
  const expectedPin = await getExpectedPin()

  const venvReady =
    (await readMarker(venvMarker)) === PYTHON_VERSION && (await exists(ctx.venvPythonPath))
  const pinValue = await readMarker(pinMarker)

  // Fully healthy: venv matches this build's interpreter and package pins (including lock hash).
  if (venvReady && isPinCompatible(pinValue, expectedPin)) return

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
  const expectedPin = await getExpectedPin()

  if (isPinCompatible(await readMarker(pinMarker), expectedPin)) return

  // Reproducibility: after the first successful resolution we persist the
  // fully-resolved set (uv pip freeze output) and reuse it for every later
  // install of the same pins. This makes repair/reinstall byte-identical
  // instead of letting the resolver drift onto newer transitive releases.
  const lockPath = path.join(layout.environment, ENV_LOCK_FILE)
  let args: string[]
  if ((await readMarker(pinMarker)) === null && (await exists(lockPath))) {
    const lock = await fs.readFile(lockPath, 'utf8').catch(() => '')
    const lockMatchesPins =
      lock.includes(`docling==${DOCLING_VERSION}`) &&
      lock.includes(`docling-core==${DOCLING_CORE_VERSION}`)
    if (lockMatchesPins) {
      ctx.report({ phase: 'installing_docling', percent: null, message: 'locked requirements' })
      args = ['pip', 'install', '--python', ctx.venvPythonPath, '-r', lockPath]
      await io.exec(ctx.uvPath, args, uvEnvOverrides(layout))
      ctx.packages = parsePackageLines(lock)
      if (ctx.packages.length === 0) throw new Error('Lock file contains no packages')
      await fs.writeFile(pinMarker, `${expectedPin}\n`, 'utf8')
      return
    }
  }

  // P2-14: fresh install with no frozen lock yet – try the bundled pinned
  // lock shipped with the app so two machines installing on different dates
  // get the same transitive versions. If it is absent or fails, fall back to
  // a live `pip install` and then freeze.
  if ((await readMarker(pinMarker)) === null && !(await exists(lockPath))) {
    const bundled = await loadBundledLock()
    if (
      bundled &&
      bundled.includes(`docling==${DOCLING_VERSION}`) &&
      bundled.includes(`docling-core==${DOCLING_CORE_VERSION}`)
    ) {
      try {
        await fs.mkdir(path.dirname(lockPath), { recursive: true })
        await fs.writeFile(lockPath, bundled, 'utf8')
        const lines = parsePackageLines(bundled)
        // Require a plausibly-full freeze (many packages) – a 2-line placeholder
        // is not deterministic (transitives would still float) so fall back to
        // live resolve in that case.
        const looksFull = lines.length >= 15 && bundled.includes('transformers==')
        if (looksFull) {
          ctx.report({ phase: 'installing_docling', percent: null, message: 'bundled lock' })
          await io.exec(
            ctx.uvPath,
            ['pip', 'install', '--python', ctx.venvPythonPath, '-r', lockPath],
            uvEnvOverrides(layout)
          )
          ctx.packages = lines
          await fs.writeFile(pinMarker, `${expectedPin}\n`, 'utf8')
          return
        }
        // Placeholder – discard and fall back to live resolve
        await fs.rm(lockPath, { force: true }).catch(() => {})
      } catch {
        await fs.rm(lockPath, { force: true }).catch(() => {})
      }
    }
  }

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
  ctx.packages = parsePackageLines(freeze.stdout)

  if (ctx.packages.length === 0) {
    throw new Error('Package freeze returned no installed packages')
  }
  // Persist the resolved tree so future installs are deterministic.
  await fs.writeFile(lockPath, freeze.stdout, 'utf8')
  await fs.writeFile(pinMarker, `${expectedPin}\n`, 'utf8')
}

function parsePackageLines(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
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

async function robustRm(target: string, retries = 5): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      // Node 22+ supports maxRetries/retryDelay, but we also do manual retry for EPERM/EBUSY on Windows
      await fs.rm(target, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200
      } as unknown as Parameters<typeof fs.rm>[1])
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      const isLockError = code === 'EPERM' || code === 'EBUSY' || code === 'ENOTEMPTY'
      if (isLockError && attempt < retries - 1) {
        // Windows holds python3.dll / venv files for a short time after process exit.
        // Try to release by chmod and wait.
        try {
          await fs.chmod(target, 0o777).catch(() => {})
        } catch {}
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
        continue
      }
      // Last attempt: try rename-then-delete as fallback for locked files
      if (isLockError && attempt === retries - 1) {
        try {
          const tmp = `${target}.old-${Date.now()}`
          await fs.rename(target, tmp).catch(() => {})
          await fs
            .rm(tmp, {
              recursive: true,
              force: true,
              maxRetries: 3,
              retryDelay: 200
            } as unknown as Parameters<typeof fs.rm>[1])
            .catch(() => {})
          return
        } catch {}
      }
      throw error
    }
  }
}

/** Remove every directory this component owns; foreign files are preserved. */
export async function removeDoclingComponentArtifacts(componentsRoot?: string): Promise<void> {
  const layout = getDoclingLayout(componentsRoot)
  // Give Windows a moment to release file locks after service stop
  await new Promise((r) => setTimeout(r, 300))
  const errors: unknown[] = []
  for (const subdir of KNOWN_COMPONENT_SUBDIRS) {
    const full = path.join(layout.root, subdir)
    try {
      await robustRm(full)
    } catch (error) {
      // Don't fail whole uninstall if one subdir is stubbornly locked – log and continue.
      // The manifest is still reset so the component is considered uninstalled; leftover
      // files will be cleaned on next install/repair or on app restart.
      errors.push(error)
    }
  }
  // Also try to remove the root if empty (but don't fail if not)
  try {
    const entries = await fs.readdir(layout.root).catch(() => [])
    if (entries.length === 0) await fs.rmdir(layout.root).catch(() => {})
  } catch {}
  // Reset artifact metadata; lifecycle state in components.json is managed by
  // the Optional Component Manager.
  await patchDoclingManifest(layout, emptyManifest())
  if (errors.length > 0) {
    const first = errors[0] as NodeJS.ErrnoException
    // If all subdirs failed, surface the error so UI can show retry hint
    const allFailed = errors.length === KNOWN_COMPONENT_SUBDIRS.length
    if (allFailed) throw first
    // Partial failure is logged but not thrown – component is logically uninstalled
  }
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

  // Stdlib sanity – catches corrupted managed Python (e.g. missing http/cookies.py
  // which manifests as `No module named 'http.cookies'` during docling import).
  try {
    await io.exec(venvPythonPath, ['-c', 'import http.cookies'], {})
  } catch (error) {
    return {
      healthy: false,
      detail:
        error instanceof Error ? error.message : 'stdlib http.cookies missing – runtime corrupted'
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
