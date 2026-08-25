import { parseHttpUrl, validateHttpUrl } from '@shared/lib/urlUtils'

/** Returns an i18n error key when the provider name is missing. */
export function validateProviderName(value: string): string {
  if (!value.trim()) return 'error_name_required'
  return ''
}

/** Returns an i18n error key when the base URL is missing or malformed. */
export function validateProviderBaseUrl(value: string): string {
  if (!value.trim()) return 'error_url_required'
  const parsed = parseHttpUrl(value)
  if (!parsed) {
    return validateHttpUrl(value) === 'protocol_not_allowed'
      ? 'error_url_protocol'
      : 'error_url_invalid'
  }
  return parsed.hostname.includes('.') ? '' : 'error_url_invalid'
}
