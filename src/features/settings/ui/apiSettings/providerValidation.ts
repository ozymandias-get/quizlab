/** Returns an i18n error key when the provider name is missing. */
export function validateProviderName(value: string): string {
  if (!value.trim()) return 'error_name_required'
  return ''
}

/** Returns an i18n error key when the base URL is missing or malformed. */
export function validateProviderBaseUrl(value: string): string {
  if (!value.trim()) return 'error_url_required'
  try {
    const parsed = new URL(value.trim())
    if (!['https:', 'http:'].includes(parsed.protocol)) return 'error_url_protocol'
    if (!parsed.hostname.includes('.')) return 'error_url_invalid'
  } catch {
    return 'error_url_invalid'
  }
  return ''
}
