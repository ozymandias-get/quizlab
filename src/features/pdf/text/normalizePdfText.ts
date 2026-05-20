/**
 * Normalizes raw PDF text output: collapses whitespace, fixes line breaks,
 * removes excessive blank lines. Shared across all text extraction paths.
 */
export function normalizePdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
