import { OCR_CACHE_SCHEMA_VERSION, OCR_ENGINE_VERSION, type OcrConfig } from '../types'

/**
 * Document fingerprint = normalized path + size + streamUrl hash fragment.
 * Lightweight — no file read needed; size+path is stable per installations.
 */
export function createDocumentFingerprint(file: {
  path?: string | null
  size?: number | null
  streamUrl?: string | null
  name?: string | null
}): string {
  const pathPart = (file.path || file.name || 'unknown')
    .replaceAll(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 64)
  const sizePart = file.size != null ? String(file.size) : '0'
  const urlPart = file.streamUrl ? hashString(file.streamUrl).slice(0, 8) : 'nousrl'
  return `${pathPart}__${sizePart}__${urlPart}`
}

function hashString(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function hashConfig(config: OcrConfig): string {
  return hashString(
    `${config.language}:${config.quality}:${config.sensitivity}:${config.forceOcr ? '1' : '0'}`
  )
}

export function createOcrCacheKey(params: {
  fingerprint: string
  pageNumber: number
  engine: string
  config: OcrConfig
}): string {
  const cfgHash = hashConfig(params.config)
  return `ocr:v${OCR_CACHE_SCHEMA_VERSION}:${params.fingerprint}:${params.pageNumber}:${params.engine}:${cfgHash}:${OCR_ENGINE_VERSION}`
}

export function parseOcrCacheKey(key: string): {
  version: number
  fingerprint: string
  pageNumber: number
  engine: string
} | null {
  const parts = key.split(':')
  if (parts.length < 6) return null
  const version = Number(parts[1]?.replace('v', ''))
  if (!Number.isFinite(version)) return null
  const fingerprint = parts[2] ?? ''
  const pageNumber = Number(parts[3])
  const engine = parts[4] ?? ''
  if (!Number.isFinite(pageNumber)) return null
  return { version, fingerprint, pageNumber, engine }
}
