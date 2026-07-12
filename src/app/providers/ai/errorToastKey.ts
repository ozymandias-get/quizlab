export function toErrorToastKey(errorKey: string | undefined): string {
  if (!errorKey) return 'error_unknown_error'
  const slug = errorKey
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^\d_a-z]/g, '')
    .replaceAll(/_+/g, '_')
  if (!slug) return 'error_unknown_error'
  return `error_${slug}`
}
