import { describe, expect, it } from 'vitest'

import {
  DOCLING_CORE_VERSION,
  DOCLING_PACKAGES,
  DOCLING_VERSION,
  PYTHON_VERSION,
  UV_ASSETS,
  UV_VERSION,
  getUvAssetKey
} from '../../../features/docling/doclingVersions.js'

const EXACT_SEMVER = /^\d+\.\d+\.\d+$/
const SHA256_HEX = /^[0-9a-f]{64}$/

describe('docling pinned versions', () => {
  it('pins every toolchain version to an exact release (no floating ranges)', () => {
    expect(UV_VERSION).toMatch(EXACT_SEMVER)
    expect(PYTHON_VERSION).toMatch(EXACT_SEMVER)
    expect(DOCLING_VERSION).toMatch(EXACT_SEMVER)
    expect(DOCLING_CORE_VERSION).toMatch(EXACT_SEMVER)
  })

  it('installs docling packages with strict == requirements only', () => {
    expect(DOCLING_PACKAGES.length).toBeGreaterThan(0)
    for (const requirement of DOCLING_PACKAGES) {
      const [, operator, version] = requirement.split(/(==)/)
      expect(operator).toBe('==')
      expect(version).toMatch(EXACT_SEMVER)
    }
  })

  it('ships checksum-verified https assets for every supported platform', () => {
    for (const key of ['win32-x64', 'linux-x64', 'darwin-arm64', 'darwin-x64']) {
      const asset = UV_ASSETS[key]
      const url = new URL(asset.url)
      expect(url.protocol).toBe('https:')
      // uv assets are hosted on github.com via release URL
      expect(
        ['github.com', 'releases.astral.sh'].includes(url.hostname) ||
          url.hostname.endsWith('github.com')
      ).toBe(true)
      expect(asset.sha256).toMatch(SHA256_HEX)
      expect(asset.binaryName.length).toBeGreaterThan(0)
    }
  })

  it('resolves the asset for the running platform', () => {
    const key = getUvAssetKey()
    expect(Object.keys(UV_ASSETS)).toContain(key)
  })

  it('fails loudly on unsupported architectures instead of silently using x64', () => {
    expect(() => getUvAssetKey('win32', 'arm64')).toThrow(/Unsupported architecture/)
    expect(() => getUvAssetKey('linux', 'arm64')).toThrow(/Unsupported architecture/)
    expect(() => getUvAssetKey('sunos', 'x64')).toThrow(/Unsupported platform/)
  })
})
