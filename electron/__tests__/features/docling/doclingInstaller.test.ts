import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  inspectDoclingInstallation,
  removeDoclingComponentArtifacts,
  runDoclingPipeline,
  type DoclingInstallerIo,
  type DoclingProgressUpdate
} from '../../../features/docling/doclingInstaller.js'
import {
  getDoclingLayout,
  getVenvPythonPath,
  UV_BINARY_FILENAME
} from '../../../features/docling/doclingPaths.js'
import { readDoclingManifest } from '../../../features/docling/doclingManifest.js'
import {
  DOCLING_CORE_VERSION,
  DOCLING_VERSION,
  PYTHON_VERSION
} from '../../../features/docling/doclingVersions.js'

interface RecordedCalls {
  downloads: string[]
  execs: string[]
  extracts: string[]
  progresses: DoclingProgressUpdate[]
}

function createFakeIo(
  layout: ReturnType<typeof getDoclingLayout>,
  failsOn?: string
): {
  io: DoclingInstallerIo
  calls: RecordedCalls
} {
  const calls: RecordedCalls = { downloads: [], execs: [], extracts: [], progresses: [] }

  const io: DoclingInstallerIo = {
    async downloadAsset(url, _dest, _sha, onBytes) {
      calls.downloads.push(url)
      onBytes?.(50, 100)
      // No file is actually needed — extractArchive finds the binary in its own temp.
    },

    async exec(exe, args, _env) {
      const label = [exe, ...args].join(' ')
      calls.execs.push(label)
      if (failsOn && label.includes(failsOn)) throw new Error('injected_failure')

      if (args[0] === 'venv') {
        const venvPython = getVenvPythonPath(layout)
        await fs.mkdir(path.dirname(venvPython), { recursive: true })
        await fs.writeFile(venvPython, 'fake-python')
        return { stdout: '' }
      }
      if (args[0] === 'pip' && args[1] === 'install') return { stdout: '' }
      if (args[0] === 'pip' && args[1] === 'freeze') {
        return {
          stdout: [
            `docling==${DOCLING_VERSION}`,
            `docling-core==${DOCLING_CORE_VERSION}`,
            'transitive-dep==9.9.9'
          ].join('\n')
        }
      }
      // uv python install + import docling probe
      return { stdout: '' }
    },

    async extractArchive(_archivePath, destDir) {
      calls.extracts.push(destDir)
      await fs.mkdir(destDir, { recursive: true })
      await fs.writeFile(path.join(destDir, UV_BINARY_FILENAME), 'fake-uv-binary')
    }
  }

  return { io, calls }
}

async function makeRoot(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), 'docling-install-test-'))
}

describe('docling installer pipeline', () => {
  const roots: string[] = []

  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  function collectReports(reporter: DoclingProgressUpdate[]): DoclingProgressUpdate[] {
    return [...reporter]
  }

  it('completes a full install and records a ready manifest with the pinned versions', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)
    const { io, calls } = createFakeIo(layout)
    const reports: DoclingProgressUpdate[] = []
    const report = (update: DoclingProgressUpdate) => reports.push(update)

    await runDoclingPipeline({ componentsRoot: root, io, report })

    const manifest = await readDoclingManifest(layout)
    expect(manifest.status).toBe('ready')
    expect(manifest.install).toMatchObject({
      doclingVersion: DOCLING_VERSION,
      doclingCoreVersion: DOCLING_CORE_VERSION,
      pythonVersion: PYTHON_VERSION
    })
    expect(manifest.install?.packages).toContain(`docling==${DOCLING_VERSION}`)
    expect(manifest.install?.packages).toContain('transitive-dep==9.9.9')

    expect(calls.downloads.length).toBeGreaterThan(0)
    expect(calls.execs.some((label) => label.includes('python install'))).toBe(true)
    expect(calls.execs.some((label) => label.includes(' venv '))).toBe(true)
    expect(calls.execs.some((label) => label.includes('pip install'))).toBe(true)

    const phases = collectReports(reports).map((report) => report.phase)
    expect(phases).toContain('preparing')
    expect(phases.at(-1)).toBe('completed')
    expect(reports.find((report) => report.phase === 'completed')?.percent).toBe(100)
  })

  it('produces only real download percentages', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)
    const { io } = createFakeIo(layout)
    const reports: DoclingProgressUpdate[] = []
    await runDoclingPipeline({ componentsRoot: root, io, report: (update) => reports.push(update) })

    for (const report of reports) {
      if (report.phase !== 'downloading_runtime' && report.phase !== 'completed') {
        if (report.percent !== null) {
          expect(report.percent).toBeNull()
        }
      }
    }
    expect(
      reports.some((report) => report.phase === 'downloading_runtime' && report.percent === 50)
    ).toBe(true)
  })

  it('never leaves installed=true after an interrupted install', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)
    const { io } = createFakeIo(layout, 'venv')
    const reports: DoclingProgressUpdate[] = []

    await expect(
      runDoclingPipeline({ componentsRoot: root, io, report: (update) => reports.push(update) })
    ).rejects.toThrow('injected_failure')

    const manifest = await readDoclingManifest(layout)
    expect(manifest.status).not.toBe('ready')
    expect(manifest.install).toBeNull()
    expect(manifest.lastError).toBeTruthy()
    expect(reports.at(-1)?.phase).toBe('failed')
  })

  it('reinstalls from the frozen lock file instead of re-resolving', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)
    const { io } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io })

    // First install persists the fully resolved tree (incl. transitives).
    const lockPath = path.join(layout.environment, 'docling-lock.txt')
    expect(await fs.readFile(lockPath, 'utf8')).toContain('transitive-dep==9.9.9')

    // Crash between venv and packages → repair must reuse the lock.
    await fs.rm(path.join(layout.environment, '.docling-pin'), { force: true })
    const { io: io2, calls } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io: io2 })

    const pipInstall = calls.execs.filter((label) => label.includes('pip install'))
    expect(pipInstall).toHaveLength(1)
    expect(pipInstall[0]).toContain('-r')
    expect(pipInstall[0]).toContain('docling-lock.txt')

    const manifest = await readDoclingManifest(layout)
    expect(manifest.status).toBe('ready')
  })

  it('resumes correctly: when venv already exists only packages are reinstalled', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)
    const { io } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io })

    // Simulate a crash between venv creation and package install by erasing the
    // package pin while keeping the venv marker intact.
    const expectedPin = `${DOCLING_VERSION}|${DOCLING_CORE_VERSION}`
    const pinPath = path.join(layout.environment, '.docling-pin')
    await fs.rm(pinPath, { force: true })

    const { io: io2, calls } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io: io2 })

    expect(calls.execs.some((label) => label.includes(' venv '))).toBe(false)
    expect(calls.execs.some((label) => label.includes('pip install'))).toBe(true)

    const manifest = await readDoclingManifest(layout)
    expect(manifest.status).toBe('ready')
  })

  it('is idempotent: a healthy repair performs no extra work', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)
    const { io } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io })

    const { io: io2, calls } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io: io2 })

    expect(calls.downloads).toEqual([])
    expect(calls.extracts).toEqual([])
    // Verification probe still runs; it is cheap and honest — the value is that
    // the heavy work (uv, venv, pip) is skipped.
    expect(calls.execs.some((label) => label.includes('import docling'))).toBe(true)
    expect(
      calls.execs.filter((label) => label.includes(' venv ') || label.includes('pip install'))
    ).toEqual([])
  })

  it('treats a mismatched environment pin as an implicit update and reinstalls', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)
    const { io } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io })

    const pinPath = path.join(layout.environment, '.docling-pin')
    await fs.writeFile(pinPath, '0.0.0-old|0.0.0-old\n', 'utf8')

    const { io: io2, calls } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io: io2 })

    expect(calls.execs.some((label) => label.includes(' venv '))).toBe(true)
    expect(calls.execs.some((label) => label.includes('pip install'))).toBe(true)
  })

  it('uninstall removes only known artifact directories and preserves user content', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)
    const { io } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io })

    const foreign = path.join(layout.root, 'user-notes.txt')
    await fs.writeFile(foreign, 'must survive')

    await removeDoclingComponentArtifacts(root)

    expect(await fs.readFile(foreign, 'utf8')).toBe('must survive')
    for (const subdir of ['runtime', 'environment', 'models', 'temp', 'bin']) {
      const exists = await fs
        .access(path.join(layout.root, subdir))
        .then(() => true)
        .catch(() => false)
      expect(exists, `expected ${subdir} to be removed`).toBe(false)
    }

    const manifest = await readDoclingManifest(layout)
    expect(manifest.status).toBe('absent')
    expect(manifest.install).toBeNull()
  })

  it('health report: honest about manifest and import outcomes', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layout = getDoclingLayout(root)

    const failingIo = createFakeIo(layout, 'import docling').io
    expect((await inspectDoclingInstallation(root, failingIo)).healthy).toBe(false)

    const { io } = createFakeIo(layout)
    await runDoclingPipeline({ componentsRoot: root, io })
    expect((await inspectDoclingInstallation(root, io)).healthy).toBe(true)

    const brokenIo: DoclingInstallerIo = {
      downloadAsset: async () => {},
      extractArchive: async () => {},
      exec: async (exe) => {
        if (exe.includes('python')) throw new Error('import probe failed')
        return { stdout: '' }
      }
    }
    expect((await inspectDoclingInstallation(root, brokenIo)).healthy).toBe(false)
  })
})
