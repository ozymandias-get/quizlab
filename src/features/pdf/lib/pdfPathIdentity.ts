/**
 * Path identity for the PDF surfaces.
 *
 * Windows paths are case-insensitive and may be spelled with either separator.
 * History and tab lookups compare the same file by this key, not by the raw
 * string, so the same document does not become a second entry or a second tab.
 */
function normalizePdfPathKey(filePath: string | null | undefined): string {
  const value = (filePath ?? '').trim()
  if (!value) return ''
  const slashed = value.replaceAll('\\', '/')
  return /^[a-zA-Z]:\//.test(slashed) ? slashed.toLowerCase() : slashed
}

export function isSamePdfPath(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  return normalizePdfPathKey(left) === normalizePdfPathKey(right)
}
