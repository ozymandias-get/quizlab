import { promises as fs } from 'node:fs'
import path from 'node:path'

import { net, protocol } from 'electron'

import { getDoclingLayout } from './doclingPaths.js'

const ASSET_SCHEME = 'quizlab-asset'
const ALLOWED_HOST = 'docling'

function isSafeAssetPath(taskId: string, fileName: string): boolean {
  if (!/^[a-f0-9-]{8,64}$/.test(taskId)) return false
  if (!/^[a-f0-9-]+\.(png|jpg|jpeg|bin|webp)$/.test(fileName)) return false
  return true
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
      if (url.hostname !== ALLOWED_HOST) {
        return new Response('Forbidden', { status: 403 })
      }
      // url: quizlab-asset://docling/<taskId>/images/<fileName>
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length !== 3 || parts[1] !== 'images') {
        return new Response('Not Found', { status: 404 })
      }
      const [taskId, , fileName] = parts
      if (!isSafeAssetPath(taskId, fileName)) {
        return new Response('Forbidden', { status: 403 })
      }
      const layout = getDoclingLayout()
      const filePath = path.join(layout.root, 'documents', taskId, 'images', fileName)

      // Path traversal guard: must stay under documents/<taskId>/images
      const normalized = path.normalize(filePath)
      const expectedBase = path.join(layout.root, 'documents', taskId, 'images')
      if (!normalized.startsWith(expectedBase)) {
        return new Response('Forbidden', { status: 403 })
      }

      const data = await fs.readFile(normalized)
      const ext = path.extname(fileName).toLowerCase()
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

// For fetch-based handlers, Electron's protocol.handle expects a Response

const _net = net
