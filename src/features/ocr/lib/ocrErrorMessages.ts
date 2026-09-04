/**
 * OCR error code → i18n key mapping.
 *
 * Pure domain function extracted from `useOcrActions.ts` so error wording can
 * evolve (i18n reasons) independently of job orchestration. No React, no store.
 */
export function mapErrorToUserMessage(code: string): string {
  if (code.includes('PAGE_RENDER_FAILED')) return 'ocr_error_render_failed'
  if (code.includes('TESSERACT_NOT_AVAILABLE')) return 'ocr_error_engine_not_available'
  if (code.includes('NO_TEXT_RECOGNIZED') || code.includes('NO_NATIVE_TEXT'))
    return 'ocr_error_no_text'
  if (code.includes('TIMEOUT')) return 'ocr_error_timeout'
  return 'ocr_error_generic'
}
