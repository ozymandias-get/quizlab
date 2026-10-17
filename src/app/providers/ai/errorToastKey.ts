import i18next from 'i18next'

const UNKNOWN_ERROR_KEY = 'error_unknown_error'

/**
 * Builds the i18n key for an error code returned by the send pipelines.
 *
 * ToastItem renders `t(toast.message)`, and i18next hands an unknown key back
 * verbatim -- so a code added to a pipeline without a matching entry in
 * src/shared/i18n/locales would reach the user as a raw "error_teapot". Code
 * that the bundles do not know about is mapped to error_unknown_error instead.
 */
export function toErrorToastKey(errorKey: string | undefined): string {
  if (!errorKey) return UNKNOWN_ERROR_KEY
  const slug = errorKey
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^\d_a-z]/g, '')
    .replaceAll(/_+/g, '_')
  if (!slug) return UNKNOWN_ERROR_KEY
  const key = `error_${slug}`
  // `exists` answers undefined until i18next finishes initialising, so compare
  // against false rather than testing truthiness: before init there is no
  // answer to trust, and downgrading a valid key to the generic message would
  // hide a specific one.
  if (i18next.exists(key) === false) return UNKNOWN_ERROR_KEY
  return key
}
