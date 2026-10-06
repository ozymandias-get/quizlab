/**
 * Build-time feature flag for the native canvas PDF viewer.
 *
 * ## Default is the shipped legacy viewer
 *
 * `VITE_NATIVE_PDF_VIEWER` is unset in every committed configuration, and an
 * unset — or anything other than the exact string `true` — resolves to
 * `false`. The legacy `@react-pdf-viewer` + `pdfjs-dist@3.11.174` path is
 * therefore the default, and the native viewer is opt-in only.
 *
 * Loose truthiness is deliberately rejected. Vite exposes environment values as
 * strings, so `VITE_NATIVE_PDF_VIEWER=false`, `0`, `TRUE ` or `yes` must not be
 * read as "on": the whole point of the flag is that an ordinary deployment
 * variable cannot silently swap the shipped PDF renderer for an experimental
 * one.
 *
 * ## Read at call time, not at module load
 *
 * `import.meta.env` is read inside the function rather than captured in a
 * module-level constant. That keeps the flag testable without a build, and it
 * means the switch is evaluated by the same code path in dev, in a production
 * build and in the packaged Electron app.
 */
export const NATIVE_PDF_VIEWER_ENV_KEY = 'VITE_NATIVE_PDF_VIEWER'

/** The only accepted opt-in value. Everything else — including `undefined` — is off. */
const OPT_IN_VALUE = 'true'

/**
 * Parse a raw environment value into the opt-in decision.
 *
 * Split out from {@link isNativePdfViewerEnabled} so the parsing rule can be
 * asserted directly, for every non-`true` spelling that must stay off.
 */
export function readNativePdfViewerFlag(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  return raw.trim().toLowerCase() === OPT_IN_VALUE
}

/** Whether the native canvas viewer replaces the legacy `<Viewer>` for this build. */
export function isNativePdfViewerEnabled(): boolean {
  return readNativePdfViewerFlag(import.meta.env[NATIVE_PDF_VIEWER_ENV_KEY])
}
