import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import type { QuizLabDocument } from '../../../shared/types/quizlabDocument.js'
import { Logger } from '../../core/logger.js'
import { DOCLING_CORE_VERSION, DOCLING_VERSION } from './doclingVersions.js'

// Schema version for the cached document format. Bump when QuizLabDocument changes incompatibly.
export const QUIZLAB_DOCUMENT_SCHEMA_VERSION = 1
// Adapter/parser version – bump when doclingAdapter logic changes.
export const QUIZLAB_ADAPTER_VERSION = '1.1.0'

export interface CacheManifest {
  sourceHash: string
  parser: 'docling'
  parserVersion: string
  doclingVersion: string
  doclingCoreVersion: string
  schemaVersion: number
  pipelineHash?: string
  createdAt: number
  updatedAt: number
}

function getDocumentCacheRoot(): string {
  return path.join(app.getPath('userData'), 'document-cache')
}

function getCacheDir(sourceHash: string): string {
  return path.join(getDocumentCacheRoot(), sourceHash)
}

function getManifestPath(sourceHash: string): string {
  return path.join(getCacheDir(sourceHash), 'manifest.json')
}

function getDocumentPath(sourceHash: string): string {
  return path.join(getCacheDir(sourceHash), 'document.json')
}

function getAssetsDir(sourceHash: string): string {
  return path.join(getCacheDir(sourceHash), 'assets')
}

export async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function getCurrentPipelineHash(): Promise<string> {
  try {
    const { getPipelinePrefs, pipelinePrefsHash } = await import('./doclingPipelineSettings.js')
    const prefs = await getPipelinePrefs()
    return pipelinePrefsHash(prefs)
  } catch {
    return '0-0-1-1'
  }
}

function isCompatibleManifest(manifest: CacheManifest, currentPipelineHash: string): boolean {
  if (manifest.schemaVersion !== QUIZLAB_DOCUMENT_SCHEMA_VERSION) return false
  if (manifest.parserVersion !== QUIZLAB_ADAPTER_VERSION) return false
  if (manifest.doclingVersion !== DOCLING_VERSION) return false
  if (manifest.doclingCoreVersion !== DOCLING_CORE_VERSION) return false
  // Pipeline prefs changed -> invalidate (old caches lack pipelineHash)
  if (manifest.pipelineHash !== undefined && manifest.pipelineHash !== currentPipelineHash)
    return false
  if (manifest.pipelineHash === undefined && currentPipelineHash !== '0-0-1-1') return false
  return true
}

export async function getCachedDocument(sourceHash: string): Promise<QuizLabDocument | null> {
  if (!/^[a-f0-9]{64}$/.test(sourceHash)) {
    Logger.warn('[DocumentCache] Invalid hash format', { sourceHash })
    return null
  }
  const manifestPath = getManifestPath(sourceHash)
  const docPath = getDocumentPath(sourceHash)

  try {
    const manifestRaw = await fs.readFile(manifestPath, 'utf8')
    let manifest: CacheManifest
    try {
      manifest = JSON.parse(manifestRaw) as CacheManifest
    } catch {
      // Corrupted manifest – invalidate
      Logger.warn('[DocumentCache] Corrupted manifest, invalidating', { sourceHash })
      await invalidateCache(sourceHash).catch(() => {})
      return null
    }

    const currentPipelineHash = await getCurrentPipelineHash()
    if (!isCompatibleManifest(manifest, currentPipelineHash)) {
      Logger.info('[DocumentCache] Version mismatch, invalidating', { sourceHash })
      await invalidateCache(sourceHash).catch(() => {})
      return null
    }

    const docRaw = await fs.readFile(docPath, 'utf8')
    let doc: QuizLabDocument
    try {
      doc = JSON.parse(docRaw) as QuizLabDocument
    } catch {
      Logger.warn('[DocumentCache] Corrupted document, invalidating', { sourceHash })
      await invalidateCache(sourceHash).catch(() => {})
      return null
    }

    // Basic sanity check
    if (!doc || typeof doc.id !== 'string' || !Array.isArray(doc.blocks)) {
      await invalidateCache(sourceHash).catch(() => {})
      return null
    }

    return doc
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return null
    if (code === 'EACCES' || code === 'EPERM') {
      Logger.warn('[DocumentCache] Permission denied, invalidating', { sourceHash, code })
      await invalidateCache(sourceHash).catch(() => {})
      return null
    }
    Logger.warn('[DocumentCache] Read failed', { sourceHash, error: String(error) })
    return null
  }
}

export async function putCachedDocument(
  sourceHash: string,
  document: QuizLabDocument,
  assets: Array<{ assetId: string; data: Buffer; ext: string }> = []
): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(sourceHash)) throw new Error('Invalid sourceHash')
  const cacheDir = getCacheDir(sourceHash)
  const tmpDir = `${cacheDir}.tmp.${randomBytes(4).toString('hex')}`

  try {
    await fs.mkdir(tmpDir, { recursive: true })
    await fs.mkdir(path.join(tmpDir, 'assets'), { recursive: true })

    const pipelineHash = await getCurrentPipelineHash()
    const manifest: CacheManifest = {
      sourceHash,
      parser: 'docling',
      parserVersion: QUIZLAB_ADAPTER_VERSION,
      doclingVersion: DOCLING_VERSION,
      doclingCoreVersion: DOCLING_CORE_VERSION,
      schemaVersion: QUIZLAB_DOCUMENT_SCHEMA_VERSION,
      pipelineHash,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Write manifest and document to temp
    await fs.writeFile(
      path.join(tmpDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    )
    await fs.writeFile(
      path.join(tmpDir, 'document.json'),
      JSON.stringify(document, null, 2),
      'utf8'
    )

    // Write assets if any (already handled separately, but keep for future)
    for (const asset of assets) {
      await fs.writeFile(path.join(tmpDir, 'assets', `${asset.assetId}.${asset.ext}`), asset.data)
    }

    // Atomic rename – handle cross-device EXDEV by falling back to copy
    try {
      await fs.rename(tmpDir, cacheDir)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code === 'EXDEV') {
        await fs.mkdir(cacheDir, { recursive: true })
        await fs.cp(tmpDir, cacheDir, { recursive: true, force: true })
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      } else if (code === 'EEXIST') {
        // Concurrent write won – keep existing cache, discard tmp
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
        return
      } else if (code === 'ENOSPC') {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
        throw new Error('Disk full while writing cache')
      } else if (code === 'EACCES' || code === 'EPERM') {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
        throw new Error('Permission denied while writing cache')
      } else {
        throw err
      }
    }
  } catch (error) {
    // Cleanup temp on failure
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

export async function copyAssetsToCache(
  sourceHash: string,
  sourceImagesDir: string
): Promise<void> {
  const destDir = getAssetsDir(sourceHash)
  try {
    const entries = await fs.readdir(sourceImagesDir)
    if (entries.length === 0) return
    await fs.mkdir(destDir, { recursive: true })
    for (const entry of entries) {
      const src = path.join(sourceImagesDir, entry)
      const dest = path.join(destDir, entry)
      try {
        await fs.copyFile(src, dest)
      } catch {}
    }
  } catch {
    // Source may not exist – ignore
  }
}

export async function invalidateCache(sourceHash: string): Promise<void> {
  const cacheDir = getCacheDir(sourceHash)
  await fs.rm(cacheDir, { recursive: true, force: true }).catch(() => {})
  // Also remove tmp dirs that may have been left behind on crash
  const root = getDocumentCacheRoot()
  try {
    const entries = await fs.readdir(root)
    for (const entry of entries) {
      if (entry.startsWith(`${sourceHash}.tmp.`)) {
        await fs.rm(path.join(root, entry), { recursive: true, force: true }).catch(() => {})
      }
    }
  } catch {}
}

export async function clearAllDocumentCaches(): Promise<void> {
  const root = getDocumentCacheRoot()
  await fs.rm(root, { recursive: true, force: true }).catch(() => {})
}

// For testing: allow injecting custom root
export function _getDocumentCacheRootForTests(): string {
  return getDocumentCacheRoot()
}

export function _resetCacheForTests(): void {
  // No in-memory state
}
