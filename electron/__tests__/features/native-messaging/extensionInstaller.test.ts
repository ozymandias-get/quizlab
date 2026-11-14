import { promises as fs } from 'node:fs'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => os.tmpdir(),
    getVersion: () => '7.5.2'
  }
}))

import {
  BundledExtensionInstaller,
  ExtensionInstallError
} from '../../../features/native-messaging/extensionInstaller.js'

/** The public key of the extension this app accepts. */
const PINNED_KEY = (
  JSON.parse(readFileSync('extensions/quizlab-session-extension/manifest.json', 'utf-8')) as {
    key: string
  }
).key

const EXTENSION_FILES = [
  'background.js',
  'popup.html',
  'popup.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
]

/** Writes a small but manifest-complete extension into `directory`. */
async function writeExtension(
  directory: string,
  options: { version?: string; manifest?: Record<string, unknown> } = {}
): Promise<void> {
  await fs.mkdir(path.join(directory, 'icons'), { recursive: true })
  const manifest = options.manifest ?? {
    manifest_version: 3,
    name: 'Quizlab Site Session Bridge',
    version: options.version ?? '1.4.0',
    key: PINNED_KEY,
    background: { service_worker: 'background.js' },
    action: { default_popup: 'popup.html' },
    icons: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    }
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2))
  for (const relative of EXTENSION_FILES) {
    await fs.writeFile(path.join(directory, relative), `// ${relative}\n`)
  }
}

describe('BundledExtensionInstaller', () => {
  let root: string
  let sourceDirectory: string
  let targetDirectory: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'quizlab-extension-'))
    sourceDirectory = path.join(root, 'bundle')
    targetDirectory = path.join(root, 'user-data', 'extension', 'quizlab-session-extension')
    await writeExtension(sourceDirectory)
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  function installer(appVersion = '7.5.2'): BundledExtensionInstaller {
    return new BundledExtensionInstaller({ sourceDirectory, targetDirectory, appVersion })
  }

  it('copies the bundle to the user folder and reports the manifest version', async () => {
    const result = await installer().install()

    expect(result).toEqual({
      path: targetDirectory,
      version: '1.4.0',
      refreshed: true
    })
    await expect(
      fs.readFile(path.join(targetDirectory, 'manifest.json'), 'utf-8')
    ).resolves.toContain('1.4.0')
    await expect(fs.readFile(path.join(targetDirectory, 'popup.js'), 'utf-8')).resolves.toContain(
      'popup.js'
    )
    // The marker lives next to the loaded folder, not inside it.
    const marker = JSON.parse(
      await fs.readFile(path.join(root, 'user-data', 'extension', '.install.json'), 'utf-8')
    ) as { appVersion: string; extensionVersion: string }
    expect(marker).toEqual({ appVersion: '7.5.2', extensionVersion: '1.4.0' })
  })

  it('reuses the copy when neither the app nor the extension changed', async () => {
    await installer().install()

    const second = await installer().install()

    expect(second.refreshed).toBe(false)
    expect(second.version).toBe('1.4.0')
  })

  it('refreshes the copy after the extension version changed', async () => {
    await installer().install()
    await writeExtension(sourceDirectory, { version: '1.4.1' })

    const result = await installer().install()

    expect(result).toMatchObject({ version: '1.4.1', refreshed: true })
    await expect(
      fs.readFile(path.join(targetDirectory, 'manifest.json'), 'utf-8')
    ).resolves.toContain('1.4.1')
  })

  it('refreshes the copy after the app version changed', async () => {
    await installer('7.5.2').install()

    const result = await installer('7.6.0').install()

    expect(result.refreshed).toBe(true)
    const marker = JSON.parse(
      await fs.readFile(path.join(root, 'user-data', 'extension', '.install.json'), 'utf-8')
    ) as { appVersion: string }
    expect(marker.appVersion).toBe('7.6.0')
  })

  it('copies again when the installed folder became incomplete', async () => {
    await installer().install()
    await fs.rm(path.join(targetDirectory, 'popup.js'))

    const result = await installer().install()

    expect(result.refreshed).toBe(true)
    await expect(fs.access(path.join(targetDirectory, 'popup.js'))).resolves.toBeUndefined()
  })

  it('does not touch an existing install when the bundle is missing', async () => {
    await installer().install()
    await fs.rm(sourceDirectory, { recursive: true, force: true })

    await expect(installer().install()).rejects.toMatchObject({
      failure: 'not_found'
    })
    await expect(fs.access(path.join(targetDirectory, 'popup.js'))).resolves.toBeUndefined()
  })

  it('does not replace the install when a bundle file is missing', async () => {
    await installer().install()
    await fs.rm(path.join(sourceDirectory, 'popup.js'))

    await expect(installer().install()).rejects.toBeInstanceOf(ExtensionInstallError)
    // The copy Chrome is loading is still the complete one.
    await expect(fs.access(path.join(targetDirectory, 'popup.js'))).resolves.toBeUndefined()
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
        action: { default_popup: 'popup.html' },
        icons: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' }
      }
    })

    // Chrome would derive another id, and the bridge's origin allowlist would
    // reject the extension that this app just told the user to load.
    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
  })

  it('refuses a manifest without the pinned key', async () => {
    await writeExtension(sourceDirectory, {
      manifest: {
        manifest_version: 3,
        version: '1.4.0',
        background: { service_worker: 'background.js' },
        action: { default_popup: 'popup.html' },
        icons: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' }
      }
    })

    // Without the key Chrome would load the extension under another id, and
    // the bridge's origin allowlist would reject every request.
    await expect(installer().install()).rejects.toMatchObject({ failure: 'invalid_manifest' })
  })
})
