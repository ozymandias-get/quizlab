/**
 * Document fingerprint — prefers PDF.js fingerprint/content hash when available,
 * falls back to a hash of path+size+streamUrl+name.
 *
 * Previously lived under the OCR feature; moved here because the PDF viewer
 * (active snapshot) and screenshot capture rely on it independently of OCR.
 */
export function createDocumentFingerprint(file: {
  path?: string | null
  size?: number | null
  streamUrl?: string | null
  name?: string | null
  /** Optional stronger fingerprint from pdfjs-dist (pdfDocument.fingerprints[0]) */
  pdfFingerprint?: string | null
  /** Optional content hash (e.g., SHA-256 of file bytes sampling) from main process */
  contentHash?: string | null
}): string {
  if (file.contentHash && file.contentHash.length >= 8) {
    return `ch_${sanitize(file.contentHash.slice(0, 32))}`
  }
  if (file.pdfFingerprint && file.pdfFingerprint.length >= 4) {
    return `pdf_${sanitize(file.pdfFingerprint.slice(0, 64))}`
  }

  const pathPart = sanitize((file.path || file.name || 'unknown').slice(0, 128))
  const sizePart = file.size != null ? String(file.size) : '0'
  const urlPart = file.streamUrl ? hashString64(file.streamUrl).slice(0, 16) : 'nousrl'
  const nameHash = file.name ? hashString64(file.name).slice(0, 8) : ''
  const pathHash = file.path ? hashString64(file.path).slice(0, 8) : ''
  return `${pathPart}__${sizePart}__${urlPart}${pathHash}${nameHash}`
}

function sanitize(s: string): string {
  return s.replaceAll(/[^a-zA-Z0-9-_]/g, '_').slice(0, 64)
}

/** 64-bit FNV-1a variant producing 16 hex chars */
function hashString64(s: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x811c9dc5 ^ 0xdeadbeef
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= c ^ (h1 & 0xff)
    h2 = Math.imul(h2, 0x01000193)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}
