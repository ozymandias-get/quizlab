import { promises as fs, readFileSync } from 'node:fs'
import { symlinkSync, unlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const appState = vi.hoisted(() => ({
  isPackaged: false,
  appPath: process.cwd(),
  userData: '',
  version: '7.5.2'
}))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return appState.isPackaged
    },
    getAppPath: () => appState.appPath,
    getPath: () => appState.userData,
    getVersion: () => appState.version
  }
}))

import {
  QUIZLAB_DEV_EXTENSION_ID,
  QUIZLAB_DEV_EXTENSION_NAME
} from '../../../../shared/constants/extensionRelease.js'
import {
  BundledExtensionInstaller,
  ExtensionInstallError
} from '../../../features/native-messaging/extensionInstaller.js'
import { deriveExtensionIdFromKey } from '../../../features/native-messaging/nativeMessagingOrigin.js'

/** The public key of the extension this app accepts. */
const PINNED_KEY = (
  JSON.parse(readFileSync('extensions/quizlab-session-extension/manifest.json', 'utf-8')) as {
    key: string
  }
).key

const EXTENSION_FILES = [
  'background.js',
  'sidepanel.html',
  'sidepanel.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
]

/** Writes a small but manifest-complete extension into `directory`. */
async function writeExtension(
  directory: string,
  options: { version?: string; manifest?: Record<string, unknown>; background?: string } = {}
): Promise<void> {
  await fs.mkdir(path.join(directory, 'icons'), { recursive: true })
  const manifest = options.manifest ?? {
    manifest_version: 3,
    name: 'Quizlab Site Session Bridge',
    version: options.version ?? '1.4.0',
    key: PINNED_KEY,
    background: { service_worker: 'background.js' },
    side_panel: { default_path: 'sidepanel.html' },
    icons: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    }
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2))
  for (const relative of EXTENSION_FILES) {
    const content =
      relative === 'background.js' ? (options.background ?? '// background\n') : `// ${relative}\n`
    await fs.writeFile(path.join(directory, relative), content)
  }
}

/** An error with the Windows code a locked directory reports. */
function lockedError(): NodeJS.ErrnoException {
  const error = new Error('the file is locked') as NodeJS.ErrnoException
  error.code = 'EPERM'
  return error
}

describe('BundledExtensionInstaller', () => {
  let root: string
  let sourceDirectory: string
  let targetDirectory: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'quizlab-extension-'))
    sourceDirectory = path.join(root, 'bundle')
    targetDirectory = path.join(root, 'user-data', 'extension', 'quizlab-session-extension')
    appState.userData = path.join(root, 'user-data')
    appState.isPackaged = false
    appState.version = '7.5.2'
    await writeExtension(sourceDirectory)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(root, { recursive: true, force: true })
  })

  function installer(appVersion = '7.5.2'): BundledExtensionInstaller {
    return new BundledExtensionInstaller({ sourceDirectory, targetDirectory, appVersion })
  }

  function devInstaller(
    appVersion = '7.5.2',
    target = path.join(root, 'user-data', 'extension', 'quizlab-session-extension-dev')
  ): BundledExtensionInstaller {
    return new BundledExtensionInstaller({
      sourceDirectory,
      targetDirectory: target,
      appVersion,
      environment: 'dev'
    })
  }

  async function readTarget(relative: string): Promise<string> {
    return fs.readFile(path.join(targetDirectory, relative), 'utf-8')
  }

  async function marker(): Promise<{
    appVersion: string
    extensionVersion: string
    fingerprint: string
  }> {
    return JSON.parse(
      await fs.readFile(path.join(root, 'user-data', 'extension', '.install.json'), 'utf-8')
    ) as { appVersion: string; extensionVersion: string; fingerprint: string }
  }

  async function exists(target: string): Promise<boolean> {
    try {
      await fs.access(target)
      return true
    } catch {
      return false
    }
  }

  it('copies the bundle to the user folder and reports the manifest version', async () => {
    const result = await installer().install()

    expect(result).toEqual({
      path: targetDirectory,
      version: '1.4.0',
      refreshed: true
    })
    await expect(readTarget('manifest.json')).resolves.toContain('1.4.0')
    await expect(readTarget('sidepanel.js')).resolves.toContain('sidepanel.js')
    const saved = await marker()
    expect(saved.appVersion).toBe('7.5.2')
    expect(saved.extensionVersion).toBe('1.4.0')
    expect(saved.fingerprint).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reuses the copy when neither the app nor the bundle changed', async () => {
    await installer().install()
    const copy = vi.spyOn(fs, 'cp')

    const second = await installer().install()

    expect(second.refreshed).toBe(false)
    expect(second.version).toBe('1.4.0')
    // Content is unchanged: no copy at all, not only a matching marker.
    expect(copy).not.toHaveBeenCalled()
  })

  it('refreshes the copy after the extension version changed', async () => {
    await installer().install()
    await writeExtension(sourceDirectory, { version: '1.4.1' })

    const result = await installer().install()

    expect(result).toMatchObject({ version: '1.4.1', refreshed: true })
    await expect(readTarget('manifest.json')).resolves.toContain('1.4.1')
  })

  it('does not copy again when the app version changed but the bundle is identical', async () => {
    await installer('7.5.2').install()
    const copy = vi.spyOn(fs, 'cp')

    const result = await installer('7.6.0').install()

    expect(result.refreshed).toBe(false)
    expect(copy).not.toHaveBeenCalled()
    // The marker still describes the app that prepared the copy, without the
    // loaded folder being touched.
    expect((await marker()).appVersion).toBe('7.6.0')
  })

  it('refreshes the copy when only a file changed, with the same versions', async () => {
    await installer().install()
    const before = await marker()
    await writeExtension(sourceDirectory, { background: '// changed worker\n' })

    const result = await installer().install()

    expect(result.refreshed).toBe(true)
    await expect(readTarget('background.js')).resolves.toBe('// changed worker\n')
    const after = await marker()
    expect(after.extensionVersion).toBe('1.4.0')
    expect(after.fingerprint).not.toBe(before.fingerprint)
  })

  it('copies again when the installed folder became incomplete', async () => {
    await installer().install()
    await fs.rm(path.join(targetDirectory, 'sidepanel.js'))

    const result = await installer().install()

    expect(result.refreshed).toBe(true)
    await expect(exists(path.join(targetDirectory, 'sidepanel.js'))).resolves.toBe(true)
  })

  it('runs two overlapping installs as one consistent operation', async () => {
    const copy = vi.spyOn(fs, 'cp')
    const shared = installer()

    const [first, second] = await Promise.all([shared.install(), shared.install()])

    expect(first).toMatchObject({ path: targetDirectory, refreshed: true })
    expect(second).toEqual(first)
    expect(copy).toHaveBeenCalledTimes(1)
    await expect(readTarget('background.js')).resolves.toBe('// background\n')
  })

  it('keeps the working copy when the staging copy fails', async () => {
    await installer().install()
    await writeExtension(sourceDirectory, { version: '1.4.1' })
    vi.spyOn(fs, 'cp').mockRejectedValueOnce(new Error('ENOSPC: no space left'))

    await expect(installer().install()).rejects.toMatchObject({ failure: 'copy_failed' })

    await expect(readTarget('manifest.json')).resolves.toContain('1.4.0')
    expect(await exists(path.join(root, 'user-data', 'extension', '.install-staging'))).toBe(false)
    expect(await exists(path.join(root, 'user-data', 'extension', '.install-backup'))).toBe(false)
  })

  it('keeps the working copy when it cannot be moved aside', async () => {
    await installer().install()
    await writeExtension(sourceDirectory, { version: '1.4.1' })
    const rename = vi.spyOn(fs, 'rename').mockRejectedValue(lockedError())

    await expect(installer().install()).rejects.toMatchObject({ failure: 'copy_failed' })

    expect(
      rename.mock.calls.filter(([, to]) => String(to).endsWith('.install-backup'))
    ).toHaveLength(3)
    await expect(readTarget('manifest.json')).resolves.toContain('1.4.0')
    expect(await exists(path.join(root, 'user-data', 'extension', '.install-staging'))).toBe(false)
  })

  it('restores the previous copy when the new one cannot be moved in', async () => {
    await installer().install()
    await writeExtension(sourceDirectory, { version: '1.4.1' })
    const realRename = fs.rename
    vi.spyOn(fs, 'rename').mockImplementation((from, to) => {
      if (String(from).endsWith('.install-staging')) {
        return Promise.reject(lockedError())
      }
      return realRename(from, to)
    })

    await expect(installer().install()).rejects.toMatchObject({ failure: 'copy_failed' })

    await expect(readTarget('manifest.json')).resolves.toContain('1.4.0')
    expect(await exists(path.join(root, 'user-data', 'extension', '.install-staging'))).toBe(false)
    expect(await exists(path.join(root, 'user-data', 'extension', '.install-backup'))).toBe(false)
  })

  it('restores an interrupted swap before the next attempt', async () => {
    await installer().install()
    const parent = path.join(root, 'user-data', 'extension')
    // The crash window: the old copy was moved aside and the new one never
    // arrived. The staging folder is a leftover.
    await fs.rename(targetDirectory, path.join(parent, '.install-backup'))
    await fs.mkdir(path.join(parent, '.install-staging'), { recursive: true })
    await writeExtension(sourceDirectory, { version: '1.4.1' })
    vi.spyOn(fs, 'cp').mockRejectedValueOnce(new Error('ENOSPC: no space left'))

    await expect(installer().install()).rejects.toMatchObject({ failure: 'copy_failed' })

    // The old version is back where Chrome loads it.
    await expect(readTarget('manifest.json')).resolves.toContain('1.4.0')
    expect(await exists(path.join(parent, '.install-staging'))).toBe(false)
  })

  it('refuses a manifest path that escapes the bundle', async () => {
    await installer().install()
    await writeExtension(sourceDirectory, {
      manifest: {
        manifest_version: 3,
        version: '1.4.0',
        key: PINNED_KEY,
        background: { service_worker: '../outside.js' },
        side_panel: { default_path: 'sidepanel.html' },
        icons: { '16': 'icons/icon16.png' }
      }
    })
    await fs.writeFile(path.join(root, 'outside.js'), '// outside\n')

    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
    await expect(readTarget('manifest.json')).resolves.toContain('1.4.0')
  })

  it('refuses an absolute manifest path', async () => {
    await writeExtension(sourceDirectory, {
      manifest: {
        manifest_version: 3,
        version: '1.4.0',
        key: PINNED_KEY,
        background: { service_worker: path.join(os.tmpdir(), 'outside.js') },
        side_panel: { default_path: 'sidepanel.html' },
        icons: { '16': 'icons/icon16.png' }
      }
    })

    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
  })

  it('refuses a manifest file that is a directory', async () => {
    await fs.rm(path.join(sourceDirectory, 'background.js'))
    await fs.mkdir(path.join(sourceDirectory, 'background.js'))

    await expect(installer().install()).rejects.toMatchObject({ failure: 'not_found' })
  })

  it('refuses an empty script', async () => {
    await writeExtension(sourceDirectory, { background: '' })

    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
  })

  it('refuses a corrupted script', async () => {
    await fs.writeFile(path.join(sourceDirectory, 'sidepanel.js'), 'function (\n')

    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
  })

  it('refuses a manifest that is not valid JSON', async () => {
    await fs.writeFile(path.join(sourceDirectory, 'manifest.json'), '{ not json')

    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
  })

  it('refuses a manifest whose referenced asset is missing', async () => {
    await fs.rm(path.join(sourceDirectory, 'icons', 'icon16.png'))

    await expect(installer().install()).rejects.toMatchObject({ failure: 'not_found' })
    expect(await exists(targetDirectory)).toBe(false)
  })

  it('refuses a symbolic link in the bundle', async () => {
    const outside = path.join(root, 'outside-directory')
    await fs.mkdir(outside)
    try {
      symlinkSync(outside, path.join(sourceDirectory, 'linked'), 'junction')
    } catch {
      // Creating a junction needs a filesystem that supports it; the check is
      // skipped only where the test cannot create one at all.
      return
    }
    try {
      await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
      expect(await exists(targetDirectory)).toBe(false)
    } finally {
      try {
        unlinkSync(path.join(sourceDirectory, 'linked'))
      } catch {
        // already gone
      }
    }
  })

  it('does not touch an existing install when the bundle is missing', async () => {
    await installer().install()
    await fs.rm(sourceDirectory, { recursive: true, force: true })

    await expect(installer().install()).rejects.toMatchObject({ failure: 'not_found' })
    await expect(readTarget('sidepanel.js')).resolves.toContain('sidepanel.js')
  })

  it('does not replace the install when a bundle file is missing', async () => {
    await installer().install()
    await fs.rm(path.join(sourceDirectory, 'sidepanel.js'))

    await expect(installer().install()).rejects.toBeInstanceOf(ExtensionInstallError)
    await expect(readTarget('sidepanel.js')).resolves.toContain('sidepanel.js')
  })

  it('refuses a manifest that is not manifest v3', async () => {
    await fs.writeFile(
      path.join(sourceDirectory, 'manifest.json'),
      JSON.stringify({ manifest_version: 2, version: '1.0.0', key: PINNED_KEY })
    )

    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
  })

  it('refuses a key that belongs to another extension', async () => {
    await writeExtension(sourceDirectory, {
      manifest: {
        manifest_version: 3,
        version: '1.4.0',
        key: Buffer.from('another-extension-key').toString('base64'),
        background: { service_worker: 'background.js' },
        side_panel: { default_path: 'sidepanel.html' },
        icons: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' }
      }
    })

    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
  })

  it('reads the packaged bundle from the resources folder', async () => {
    const resources = path.join(root, 'resources')
    await writeExtension(path.join(resources, 'extension'))
    appState.isPackaged = true
    Object.defineProperty(process, 'resourcesPath', {
      value: resources,
      configurable: true
    })

    const result = await new BundledExtensionInstaller().install()

    expect(result.path).toBe(path.join(appState.userData, 'extension', 'quizlab-session-extension'))
    await expect(readTarget('manifest.json')).resolves.toContain('1.4.0')
    appState.isPackaged = false
  })

  describe('the development build', () => {
    function devTarget(): string {
      return path.join(root, 'user-data', 'extension', 'quizlab-session-extension-dev')
    }

    it('writes the dev identity into its own folder and keeps the source code', async () => {
      const result = await devInstaller().install()

      expect(result).toMatchObject({ path: devTarget(), version: '1.4.0', refreshed: true })

      const manifest = JSON.parse(
        await fs.readFile(path.join(devTarget(), 'manifest.json'), 'utf-8')
      ) as { name: string; key: string; permissions: string[]; host_permissions: string[] }
      expect(manifest.name).toBe(QUIZLAB_DEV_EXTENSION_NAME)
      expect(deriveExtensionIdFromKey(manifest.key)).toBe(QUIZLAB_DEV_EXTENSION_ID)

      // The build is the same code and the same permission surface as the
      // release one.
      const sourceManifest = JSON.parse(
        await fs.readFile(path.join(sourceDirectory, 'manifest.json'), 'utf-8')
      ) as { permissions: string[]; host_permissions: string[] }
      expect(manifest.permissions).toEqual(sourceManifest.permissions)
      expect(manifest.host_permissions).toEqual(sourceManifest.host_permissions)
      await expect(fs.readFile(path.join(devTarget(), 'background.js'), 'utf-8')).resolves.toBe(
        '// background\n'
      )
      expect(await exists(path.join(root, 'user-data', 'extension', '.install-dev.json'))).toBe(
        true
      )
    })

    it('does not copy again when the prepared dev build did not change', async () => {
      await devInstaller().install()
      const copy = vi.spyOn(fs, 'cp')

      const second = await devInstaller().install()

      expect(second.refreshed).toBe(false)
      // The generated manifest takes part in the fingerprint, so an unchanged
      // source must not churn the folder Chrome has loaded.
      expect(copy).not.toHaveBeenCalled()
    })

    it('refreshes the dev build when only a source file changed', async () => {
      await devInstaller().install()
      await writeExtension(sourceDirectory, { background: '// changed worker\n' })

      const result = await devInstaller().install()

      expect(result.refreshed).toBe(true)
      await expect(fs.readFile(path.join(devTarget(), 'background.js'), 'utf-8')).resolves.toBe(
        '// changed worker\n'
      )
    })

    it('leaves the release install untouched and the other way round', async () => {
      await installer().install()
      const releaseBefore = await readTarget('background.js')
      await devInstaller().install()

      // A source change refreshes only the build that is asked for.
      await writeExtension(sourceDirectory, { background: '// new worker\n' })
      await devInstaller().install()

      await expect(readTarget('background.js')).resolves.toBe(releaseBefore)
      await expect(fs.readFile(path.join(devTarget(), 'background.js'), 'utf-8')).resolves.toBe(
        '// new worker\n'
      )

      // A release refresh does not touch the development folder either.
      await installer().install()
      await expect(fs.readFile(path.join(devTarget(), 'background.js'), 'utf-8')).resolves.toBe(
        '// new worker\n'
      )
      expect(await exists(path.join(root, 'user-data', 'extension', '.install-dev-backup'))).toBe(
        false
      )
    })

    it('reports the dev version from the manifest of the prepared copy', async () => {
      const result = await devInstaller().install()
      const marker = JSON.parse(
        await fs.readFile(path.join(root, 'user-data', 'extension', '.install-dev.json'), 'utf-8')
      ) as { extensionVersion: string }

      expect(result.version).toBe('1.4.0')
      expect(marker.extensionVersion).toBe('1.4.0')
    })

    it('prepares the real source folder as a loadable dev build', async () => {
      const dev = new BundledExtensionInstaller({ environment: 'dev' })

      const result = await dev.install()

      expect(result.path).toBe(
        path.join(appState.userData, 'extension', 'quizlab-session-extension-dev')
      )
      const manifest = JSON.parse(
        await fs.readFile(path.join(result.path, 'manifest.json'), 'utf-8')
      ) as { name: string; version: string; key: string; background: { service_worker: string } }
      expect(manifest.name).toBe(QUIZLAB_DEV_EXTENSION_NAME)
      expect(manifest.version).toBe('1.5.1')
      expect(deriveExtensionIdFromKey(manifest.key)).toBe(QUIZLAB_DEV_EXTENSION_ID)
      expect(manifest.background.service_worker).toBe('background.js')
      await expect(
        fs.readFile(path.join(result.path, 'background.js'), 'utf-8')
      ).resolves.toContain('DEV_EXTENSION_ID')
    })
  })
})
