import { promises as fs } from 'node:fs'
import path from 'node:path'

import { protocol } from 'electron'

import { getDoclingLayout } from './doclingPaths.js'

const ASSET_SCHEME = 'quizlab-asset'
const ALLOWED_HOSTS = new Set(['docling', 'docling-cache'])

export function isSafeAssetPath(taskId: string, fileName: string): boolean {
  if (
    !/^docling-[a-f0-9]{8,64}$/.test(taskId) &&
    !/^[a-f0-9-]{8,64}$/.test(taskId) &&
    !/^[a-f0-9]{64}$/.test(taskId)
  )
    return false
  if (!/^[a-f0-9-]+\.(png|jpg|jpeg|bin|webp)$/.test(fileName)) return false
  return true
}

export function isSafeHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash)
}

export function registerDoclingAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

export function registerDoclingAssetProtocol(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      if (!ALLOWED_HOSTS.has(url.hostname)) {
        return new Response('Forbidden', { status: 403 })
      }
      const parts = url.pathname.split('/').filter(Boolean)

      let filePath: string
      let expectedBase: string

      if (url.hostname === 'docling') {
        // url: quizlab-asset://docling/<taskId>/images/<fileName>
        if (parts.length !== 3 || parts[1] !== 'images') {
          return new Response('Not Found', { status: 404 })
        }
        const [taskId, , fileName] = parts
        if (!isSafeAssetPath(taskId, fileName)) {
          return new Response('Forbidden', { status: 403 })
        }
        const layout = getDoclingLayout()
        filePath = path.join(layout.root, 'documents', taskId, 'images', fileName)
        expectedBase = path.join(layout.root, 'documents', taskId, 'images')
      } else {
        // url: quizlab-asset://docling-cache/<hash>/assets/<fileName>
        if (parts.length !== 3 || parts[1] !== 'assets') {
          return new Response('Not Found', { status: 404 })
        }
        const [hash, , cFileName] = parts
        if (!isSafeHash(hash) || !isSafeAssetPath(hash, cFileName)) {
          return new Response('Forbidden', { status: 403 })
        }
        const { app } = await import('electron')
        const cacheRoot = path.join(app.getPath('userData'), 'document-cache', hash, 'assets')
        filePath = path.join(cacheRoot, cFileName)
        expectedBase = cacheRoot
      }

      // Path traversal + symlink sandbox: resolve realpath and ensure it stays inside expectedBase
      const normalized = path.normalize(filePath)
      if (!normalized.startsWith(expectedBase)) {
        return new Response('Forbidden', { status: 403 })
      }
      // Resolve realpath for both sides to defeat symlink and `..` tricks
      let realFile: string
      let realBase: string
      try {
        realFile = await fs.realpath(normalized)
        realBase = await fs.realpath(expectedBase)
      } catch {
        return new Response('Not Found', { status: 404 })
      }
      if (!realFile.startsWith(realBase + path.sep) && realFile !== realBase) {
        return new Response('Forbidden', { status: 403 })
      }

      // Symlink check: do not follow symlinks to arbitrary files (also covered by realpath above)
      const lstat = await fs.lstat(realFile)
      if (lstat.isSymbolicLink()) {
        return new Response('Forbidden', { status: 403 })
      }
      if (!lstat.isFile()) {
        return new Response('Not Found', { status: 404 })
      }
      // Size cap: refuse to serve huge images that could OOM the renderer
      if (lstat.size > 20 * 1024 * 1024) {
        return new Response('Payload Too Large', { status: 413 })
      }

      const data = await fs.readFile(realFile)
      const fileNameForMime = path.basename(realFile)
      const ext = path.extname(fileNameForMime).toLowerCase()
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
              ? 'image/webp'
              : 'application/octet-stream'

      return new Response(data, {
        headers: {
          'Content-Type': mime,
          'Content-Length': String(data.length),
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })
}
