import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { QuizLabConversionErrorCode } from '../../../shared/types/quizlabDocument.js'

const MAX_PDF_SIZE_BYTES = 500 * 1024 * 1024

export function mapErrorCode(stderr: string, code: number | null): QuizLabConversionErrorCode {
  const lower = stderr.toLowerCase()
  if (lower.includes('encrypted') || lower.includes('password')) return 'encrypted_pdf'
  if (lower.includes('corrupt') || lower.includes('damaged')) return 'corrupted_pdf'
  if (lower.includes('unsupported') || lower.includes('not a pdf')) return 'unsupported_pdf'
  if (lower.includes('timeout') || lower.includes('timed out')) return 'conversion_timeout'
  if (lower.includes('ocr') && lower.includes('fail')) return 'ocr_failure'
  if (code === 2) return 'scanned_pdf_no_text'
  return 'unknown'
}

/** Hard validation of untrusted PDF paths before anything is spawned. */
export async function validatePdfPath(
  pdfPath: string
): Promise<{ valid: true } | { valid: false; code: QuizLabConversionErrorCode; message: string }> {
  if (typeof pdfPath !== 'string' || pdfPath.length === 0 || pdfPath.length > 4096) {
    return { valid: false, code: 'unknown', message: 'Invalid pdfPath length' }
  }
  if (pdfPath.includes('\0')) return { valid: false, code: 'unknown', message: 'Invalid pdfPath' }
  if (!path.isAbsolute(pdfPath))
    return { valid: false, code: 'unknown', message: 'PDF path must be absolute' }
  if (pdfPath.split(path.sep).includes('..')) {
    return { valid: false, code: 'unknown', message: 'Invalid pdfPath traversal' }
  }
  try {
    const stat = await fs.lstat(pdfPath)
    if (stat.isSymbolicLink())
      return { valid: false, code: 'unknown', message: 'Symlink PDFs are not allowed' }
    if (!stat.isFile()) return { valid: false, code: 'unknown', message: 'Not a file' }
    if (stat.size > MAX_PDF_SIZE_BYTES) {
      return {
        valid: false,
        code: 'unknown',
        message: `PDF too large (${(stat.size / (1024 * 1024)).toFixed(1)} MB > 500 MB)`
      }
    }
    if (stat.size === 0) return { valid: false, code: 'corrupted_pdf', message: 'Empty PDF file' }
  } catch {
    return { valid: false, code: 'corrupted_pdf', message: 'PDF not found or unreadable' }
  }
  if (!pdfPath.toLowerCase().endsWith('.pdf')) {
    return { valid: false, code: 'unsupported_pdf', message: 'File is not a PDF' }
  }
  return { valid: true }
}
