import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { QuizLabConversionErrorCode } from '../../../shared/types/quizlabDocument.js'

const MAX_PDF_SIZE_BYTES = 500 * 1024 * 1024
const MAX_DOCUMENT_SIZE_BYTES = 500 * 1024 * 1024

export const SUPPORTED_DOC_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'html',
  'htm',
  'md',
  'markdown',
  'png',
  'jpg',
  'jpeg',
  'tiff',
  'tif',
  'bmp',
  'webp'
] as const

function isSupportedDocumentExtension(ext: string): boolean {
  return (SUPPORTED_DOC_EXTENSIONS as readonly string[]).includes(ext.toLowerCase())
}

export function mapErrorCode(stderr: string, code: number | null): QuizLabConversionErrorCode {
  const lower = stderr.toLowerCase()
  if (lower.includes('encrypted') || lower.includes('password')) return 'encrypted_pdf'
  if (lower.includes('corrupt') || lower.includes('damaged')) return 'corrupted_pdf'
  if (
    lower.includes('unsupported') ||
    lower.includes('not a pdf') ||
    lower.includes('not a supported')
  )
    return 'unsupported_pdf'
  if (lower.includes('timeout') || lower.includes('timed out')) return 'conversion_timeout'
  if (lower.includes('ocr') && lower.includes('fail')) return 'ocr_failure'
  if (code === 2) return 'scanned_pdf_no_text'
  return 'unknown'
}

/** Hard validation of untrusted PDF paths before anything is spawned. */
export async function validatePdfPath(
  pdfPath: string
): Promise<{ valid: true } | { valid: false; code: QuizLabConversionErrorCode; message: string }> {
  return validateDocumentPath(pdfPath)
}

/** Multi-format validation: DOCX, PPTX, HTML, Markdown, images – Docling pipeline yönlendirici */
export async function validateDocumentPath(
  filePath: string
): Promise<{ valid: true } | { valid: false; code: QuizLabConversionErrorCode; message: string }> {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > 4096) {
    return { valid: false, code: 'unknown', message: 'Invalid filePath length' }
  }
  if (filePath.includes('\0')) return { valid: false, code: 'unknown', message: 'Invalid filePath' }
  if (!path.isAbsolute(filePath))
    return { valid: false, code: 'unknown', message: 'File path must be absolute' }
  if (filePath.split(path.sep).includes('..')) {
    return { valid: false, code: 'unknown', message: 'Invalid filePath traversal' }
  }
  try {
    const stat = await fs.lstat(filePath)
    if (stat.isSymbolicLink())
      return { valid: false, code: 'unknown', message: 'Symlink documents are not allowed' }
    if (!stat.isFile()) return { valid: false, code: 'unknown', message: 'Not a file' }
    if (stat.size > MAX_DOCUMENT_SIZE_BYTES) {
      return {
        valid: false,
        code: 'unknown',
        message: `File too large (${(stat.size / (1024 * 1024)).toFixed(1)} MB > 500 MB)`
      }
    }
    if (stat.size === 0) return { valid: false, code: 'corrupted_pdf', message: 'Empty file' }
  } catch {
    return { valid: false, code: 'corrupted_pdf', message: 'File not found or unreadable' }
  }
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '')
  if (!isSupportedDocumentExtension(ext)) {
    return {
      valid: false,
      code: 'unsupported_pdf',
      message: `File is not a supported document (got .${ext})`
    }
  }
  return { valid: true }
}
