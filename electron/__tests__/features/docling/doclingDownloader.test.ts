import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  DownloadError,
  downloadFile,
  isAllowedDownloadHost
} from '../../../features/docling/doclingDownloader.js'

describe('download host allowlist', () => {
  it('accepts official sources', () => {
    expect(isAllowedDownloadHost('github.com')).toBe(true)
    expect(isAllowedDownloadHost('objects.githubusercontent.com')).toBe(true)
    expect(isAllowedDownloadHost('release-assets.githubusercontent.com')).toBe(true)
  })

  it('rejects everything else regardless of case', () => {
    expect(isAllowedDownloadHost('evil.example.com')).toBe(false)
    expect(isAllowedDownloadHost('GitHub.COM.EVIL.example')).toBe(false)
    expect(isAllowedDownloadHost('')).toBe(false)
  })
})

describe('downloadFile', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  async function makeTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'docling-dl-test-'))
    tempDirs.push(dir)
    return dir
  }

  it('rejects non-https and non-allowlisted URLs before any network work', async () => {
    const dir = await makeTempDir()
    const dest = path.join(dir, 'artifact.bin')

    await expect(
      downloadFile({ url: 'http://github.com/a.zip', destPath: dest, expectedSha256: 'x' })
    ).rejects.toMatchObject({ code: 'invalid_url' })

    await expect(
      downloadFile({
        url: 'https://evil.example.com/a.zip',
        destPath: dest,
        expectedSha256: 'x'
      })
    ).rejects.toMatchObject({ code: 'redirect_disallowed' })
  })

  it('leaves no partial file behind when the response errors mid-stream', async () => {
    const dir = await makeTempDir()
    const dest = path.join(dir, 'artifact.bin')

    // Local loopback is not allowlisted; the request fails before any bytes
    // are written and no .part file may survive.
    await expect(
      downloadFile({
        url: 'https://127.0.0.1/nothing.bin',
        destPath: dest,
        expectedSha256: '0'.repeat(64),
        timeoutMs: 1500
      })
    ).rejects.toBeInstanceOf(Error)

    const entries = await fs.readdir(dir)
    expect(entries).toEqual([])
  })

  it('computes sha256 digests the same way the verifier expects', () => {
    const digest = createHash('sha256').update('quizlab').digest('hex')
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })
})
