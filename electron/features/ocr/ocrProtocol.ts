import { app, protocol } from 'electron'
import fs from 'fs'
import path from 'path'

import { Logger } from '../../core/logger.js'

/**
 * Custom scheme serving the bundled Tesseract language data (`*.traineddata.gz`).
 *
 * Why this exists: the packaged renderer runs on `file://`, where the Fetch
 * API cannot load files (`fetch(file://…)` is rejected by Chromium). The
 * Tesseract worker downloads its language data with `fetch`, so without an
 * explicit `langPath` the packaged app depends on the jsDelivr CDN — and OCR
 * fails on fresh installs without network access ("sometimes doesn't work"
 * after installing from the exe). Serving the vendored `tessdata` directory
 * over a fetch-capable privileged scheme makes OCR work fully offline.
 *
 * Served URLs look like: `local-ocr://tessdata/eng.traineddata.gz`
 * Only the exact filenames in {@link OCR_TESSDATA_ALLOWLIST} are served;
 * everything else is 403/404 so the scheme cannot be abused as a file reader.
 */

export const OCR_SCHEME = 'local-ocr' as const
export const OCR_TESSDATA_HOST = 'tessdata' as const

/** Language-data files bundled under `src/public/tessdata` (vendored from jsDelivr `@tesseract.js-data`, `4.0.0_best_int`). */
export const OCR_TESSDATA_ALLOWLIST = new Set(['eng.traineddata.gz', 'tur.traineddata.gz'])

export function registerOcrScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: OCR_SCHEME,
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

function candidateTessdataDirs(): string[] {
  const candidates: string[] = []
  try {
    const appPath = app.getAppPath()
    // Packaged (`…/resources/app.asar`) and `electron .` after a build.
    candidates.push(path.join(appPath, 'dist', 'tessdata'))
    // Source checkout fallback (dev without a prior `vite build`).
    candidates.push(path.join(appPath, 'src', 'public', 'tessdata'))
  } catch {
    // app.getAppPath() unavailable (e.g. unit tests) — fall through.
  }
  try {
    // `process.resourcesPath` variant for packaged layouts.
    if (typeof process.resourcesPath === 'string' && process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'app.asar', 'dist', 'tessdata'))
    }
  } catch {
    // Ignore and use whatever candidates were collected.
  }
  return candidates
}

export function resolveTessdataDir(): string | null {
  for (const dir of candidateTessdataDirs()) {
    try {
      if (fs.existsSync(dir)) return dir
    } catch {
      // Ignore and try the next candidate.
    }
  }
  return null
}

function tessdataResponse(fileName: string): Response {
  const dir = resolveTessdataDir()
  if (!dir) return new Response('Not Found', { status: 404 })
  const filePath = path.join(dir, fileName)
  let data: Buffer
  try {
    data = fs.readFileSync(filePath)
  } catch {
    return new Response('Not Found', { status: 404 })
  }
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Length': String(data.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

export function registerOcrProtocol(): void {
  protocol.handle(OCR_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      // Only `local-ocr://tessdata/<allowlisted file>` is served.
      if (url.hostname !== OCR_TESSDATA_HOST) return new Response('Forbidden', { status: 403 })
      const fileName = path.basename(url.pathname)
      if (!OCR_TESSDATA_ALLOWLIST.has(fileName)) {
        return new Response('Forbidden', { status: 403 })
      }
      return tessdataResponse(fileName)
    } catch (error) {
      Logger.error('[OcrProtocol] Request Error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}
