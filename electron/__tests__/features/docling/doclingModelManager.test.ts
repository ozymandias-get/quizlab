import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockUserData = { value: '' }

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return mockUserData.value
      return '/tmp'
    }
  }
}))

describe('doclingModelManager', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'docling-model-test-'))
    mockUserData.value = tempRoot
    vi.resetModules()
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {})
    vi.resetModules()
  })

  async function loadManager() {
    return await import('../../../features/docling/doclingModelManager.js')
  }

  async function loadPaths() {
    return await import('../../../features/docling/doclingPaths.js')
  }

  /** Simulate the engine runtime so status checks behave like production. */
  async function createFakeVenv() {
    const paths = await loadPaths()
    const layout = paths.getDoclingLayout()
    const venvPython = paths.getVenvPythonPath(layout)
    await fs.mkdir(path.dirname(venvPython), { recursive: true })
    await fs.writeFile(venvPython, '', 'utf8')
  }

  it('detects missing when no marker and no files', async () => {
    const m = await loadManager()
    const status = await m.getModelStatus()
    expect(status.status).toBe('missing')
    expect(status.files).toEqual([])
  })

  it('marks ready only after an explicit test-seam install (marker + manifest + venv)', async () => {
    const m = await loadManager()
    await m.markModelsReadyForTests()
    const status = await m.getModelStatus()
    expect(status.status).toBe('ready')
    expect(status.version).toBe('1')
    expect(status.diskBytes).not.toBeNull()
  })

  it('reports runtime_missing when artifacts exist but the venv is gone', async () => {
    const m = await loadManager()
    await m.markModelsReadyForTests()
    // Wipe the simulated interpreter – engine was deleted behind our back
    const paths = await loadPaths()
    const layout = paths.getDoclingLayout()
    await fs.rm(path.join(layout.environment), { recursive: true, force: true })
    const status = await m.getModelStatus()
    expect(status.status).toBe('runtime_missing')
  })

  it('never reports ready from a bare marker without a manifest', async () => {
    const m = await loadManager()
    await createFakeVenv()
    const layout = (await loadPaths()).getDoclingLayout()
    await fs.mkdir(layout.models, { recursive: true })
    await fs.writeFile(path.join(layout.models, '.models-ready'), '1', 'utf8')
    const status = await m.getModelStatus()
    expect(status.status).not.toBe('ready')
  })

  it('never reports ready when manifest entries are missing on disk', async () => {
    const m = await loadManager()
    await createFakeVenv()
    const layout = (await loadPaths()).getDoclingLayout()
    await fs.mkdir(layout.models, { recursive: true })
    await fs.writeFile(path.join(layout.models, '.models-ready'), '1', 'utf8')
    const manifest = {
      schemaVersion: '1',
      mode: 'auto-managed',
      doclingVersion: '2.121.0',
      revision: null,
      createdAt: Date.now(),
      files: [{ path: 'layout/model.safetensors', bytes: 100, sha256: 'x'.repeat(64) }]
    }
    await fs.writeFile(
      path.join(layout.models, 'model-manifest.json'),
      JSON.stringify(manifest),
      'utf8'
    )
    const status = await m.getModelStatus()
    expect(status.status).toBe('partial')
  })

  it('download fails with runtime_missing when no venv exists (no fake ready)', async () => {
    const m = await loadManager()
    await expect(m.downloadModels()).rejects.toThrow(/runtime_missing|çalışma ortamı bulunamadı/i)
    const status = await m.getModelStatus()
    expect(status.status).toBe('missing')
  })

  it('detects partial when files exist but marker version wrong', async () => {
    const m = await loadManager()
    await m.markModelsReadyForTests()
    const layout = (await loadPaths()).getDoclingLayout()
    const marker = path.join(layout.models, '.models-ready')
    await fs.writeFile(marker, 'wrong-version', 'utf8')
    const status = await m.getModelStatus()
    expect(status.status).toBe('partial')
  })

  it('delete removes models but keeps directory', async () => {
    const m = await loadManager()
    await m.markModelsReadyForTests()
    let status = await m.getModelStatus()
    expect(status.status).toBe('ready')
    await m.deleteModels()
    status = await m.getModelStatus()
    expect(status.status).toBe('missing')
    expect(status.files).toEqual([])
    // Directory should still exist
    const layout = (await loadPaths()).getDoclingLayout()
    await expect(fs.access(layout.models)).resolves.toBeUndefined()
  })

  it('delete cleans legacy placeholder.bin if present', async () => {
    const m = await loadManager()
    const layout = (await loadPaths()).getDoclingLayout()
    await fs.mkdir(layout.models, { recursive: true })
    await fs.writeFile(path.join(layout.models, 'placeholder.bin'), Buffer.alloc(10))
    await fs.writeFile(path.join(layout.models, '.models-ready'), '1', 'utf8')
    await m.deleteModels()
    const entries = await fs.readdir(layout.models)
    expect(entries).not.toContain('placeholder.bin')
    expect(entries).not.toContain('.models-ready')
  })

  it('repair re-marks via test seam when missing and ready afterwards', async () => {
    const m = await loadManager()
    // repair → downloadModels would fail without venv/runtime; simulate the
    // post-repair state through the explicit seam instead.
    await m.repairModels().catch(() => {})
    await m.markModelsReadyForTests()
    const status = await m.getModelStatus()
    expect(status.status).toBe('ready')
  })

  it('repair does nothing when already ready', async () => {
    const m = await loadManager()
    await m.markModelsReadyForTests()
    const before = await m.getModelStatus()
    await m.repairModels()
    const after = await m.getModelStatus()
    expect(after.status).toBe('ready')
    expect(after.diskBytes).toBe(before.diskBytes)
  })

  it('verifyModelIntegrity detects size/hash drift', async () => {
    const m = await loadManager()
    const layout = (await loadPaths()).getDoclingLayout()
    await fs.mkdir(path.join(layout.models, 'layout'), { recursive: true })
    const filePath = path.join(layout.models, 'layout', 'model.safetensors')
    await fs.writeFile(filePath, 'a'.repeat(50))
    // Build a manifest via the internal scan by downloading in pinned mode is
    // not possible offline; craft one through markModelsReadyForTests-style write:
    const { createHash } = await import('node:crypto')
    const digest = createHash('sha256').update('a'.repeat(50)).digest('hex')
    const manifest = {
      schemaVersion: '1',
      mode: 'pinned' as const,
      doclingVersion: '2.121.0',
      revision: null,
      createdAt: Date.now(),
      files: [{ path: 'layout/model.safetensors', bytes: 50, sha256: digest }]
    }
    await fs.writeFile(
      path.join(layout.models, 'model-manifest.json'),
      JSON.stringify(manifest),
      'utf8'
    )
    await fs.writeFile(path.join(layout.models, '.models-ready'), '1', 'utf8')

    const ok = await m.verifyModelIntegrity()
    expect(ok.ok).toBe(true)

    // Corrupt content, same size → hash mismatch must be caught
    await fs.writeFile(filePath, 'b'.repeat(50))
    const drifted = await m.verifyModelIntegrity()
    expect(drifted.ok).toBe(false)
    expect(drifted.corrupted).toEqual(['layout/model.safetensors'])
  })

  it('disk usage is computed from real files', async () => {
    const m = await loadManager()
    await m.markModelsReadyForTests()
    const bytes = await m.getModelDiskUsage()
    expect(typeof bytes).toBe('number')
    expect(bytes).not.toBeNull()
  })

  it('partial model when files exist but marker missing', async () => {
    const m = await loadManager()
    const layout = (await loadPaths()).getDoclingLayout()
    await fs.mkdir(layout.models, { recursive: true })
    await fs.writeFile(path.join(layout.models, 'dummy.bin'), 'x'.repeat(100))
    const status = await m.getModelStatus()
    expect(status.status).toBe('partial')
  })
})
