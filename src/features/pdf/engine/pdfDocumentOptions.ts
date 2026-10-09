/**
 * The single authoritative builder for native PDF.js 6 `getDocument` options.
 *
 * Nothing else in the codebase is allowed to hand a parameter object to
 * `getDocument`. That rule is what makes the security posture reviewable: the
 * engine's scripting and asset policy is decided in one function, and the
 * architecture test pins its output.
 *
 * ## isEvalSupported
 *
 * Deliberately absent. It was removed in pdf.js 4.x — zero occurrences in
 * `build/pdf.mjs`, `build/pdf.worker.mjs` and `types/` of 6.4.299 — so the
 * option no longer exists to be set on the one `getDocument` call site there is.
 *
 * ## enableScripting
 *
 * `enableScripting: false` is the engine's scripting posture. PDF.js 6 reads it
 * (`pdf.mjs`: `enableScripting: params.enableScripting === true`) to gate PDF
 * JavaScript *actions*, and — unlike 3.x, where it was an annotation-layer-only
 * no-op for `getDocument` — it is meaningful here. It is declared on the
 * annotation-layer types but **not** on `DocumentInitParameters`, so it is added
 * through a narrow local intersection rather than a cast; `as any` would defeat
 * type-checking on every other field too.
 *
 * ## Asset URLs and useWorkerFetch
 *
 * The four asset directories are declared explicitly. `useWorkerFetch` is
 * deliberately **not** set, because PDF.js 6 derives it correctly for both
 * environments this app runs in:
 *
 *   - dev: the document base is `http://localhost:5173/`, so `isValidFetchUrl`
 *     passes and worker-side `fetch` is used
 *   - packaged Electron: the base is `file://`, so `isValidFetchUrl` fails and
 *     the default falls back to main-thread factories
 *
 * and `fetchData` itself falls back to `XMLHttpRequest` for non-http(s) URLs,
 * accepting `status === 0` — which is what a `file://` read reports. Hard-coding
 * `useWorkerFetch` here would override a scheme-aware decision that is already
 * correct and would break one of the two environments.
 */
import { type getDocument } from 'pdfjs-dist'

/**
 * `DocumentInitParameters` as shipped by 6.4.299.
 *
 * Derived from `getDocument`'s own signature rather than imported by name: the
 * package's root type entry re-exports a hand-picked subset of types and does
 * not include `DocumentInitParameters`, and the package declares no `exports`
 * map, so a deep import would mean depending on an internal file layout.
 * Deriving it keeps the engine on the public surface.
 */
type PdfDocumentInitParameters = NonNullable<Parameters<typeof getDocument>[0]>

/**
 * The document-init parameters the engine passes, plus the one option PDF.js
 * reads but does not declare. Kept narrow on purpose: only the missing key is
 * added, so a typo in any other option still fails to compile.
 */
export type SecureDocumentInitParameters = PdfDocumentInitParameters & {
  enableScripting?: boolean
}

/** Anything `getDocument` accepts as `url` (string, URL, typed array, buffer). */
export type PdfDocumentSource = NonNullable<PdfDocumentInitParameters['url']>

/** Directory name the asset staging step writes into the build output. */
export const PDFJS_ASSET_DIR = 'pdfjs'

/**
 * The asset sub-directories staged from `pdfjs-dist` at build time, in the order
 * they are declared here. `scripts`-free by design: `vite.config.mts` copies
 * these directly out of `node_modules/pdfjs-dist`.
 */
export const PDFJS_ASSET_SUBDIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const

export type PdfjsAssetSubdir = (typeof PDFJS_ASSET_SUBDIRS)[number]

/**
 * Base URL the asset directories are served from.
 *
 * `import.meta.env.BASE_URL` is `'./'` in a production build and `'/'` under the
 * dev server. Both work for the two ways this app is loaded:
 *
 *   - packaged Electron serves `dist/index.html` over `file://`, so a
 *     document-relative `./pdfjs/...` resolves inside the packaged directory
 *   - the dev server serves `dist`-independent URLs from `/`, so `./pdfjs/...`
 *     resolves against `http://localhost:5173/`
 *
 * No absolute or machine-specific path is ever embedded.
 */
function pdfAssetBaseUrl(): string {
  return import.meta.env.BASE_URL
}

function withTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

/**
 * Build the full URL for one asset sub-directory. The trailing slash is required
 * by PDF.js, which appends the individual file names to these values.
 */
export function pdfAssetUrl(subdir: PdfjsAssetSubdir, assetBaseUrl: string): string {
  const base = withTrailingSlash(assetBaseUrl)
  return `${base}${PDFJS_ASSET_DIR}/${subdir}/`
}

/**
 * The one place native PDF.js 6 document options are built.
 *
 * @param source Document source handed straight to `getDocument`.
 * @param assetBaseUrl Overridable so tests can assert URL construction without
 * depending on the bundler's `BASE_URL`.
 */
export function createPdfDocumentOptions(
  source: PdfDocumentSource,
  assetBaseUrl: string = pdfAssetBaseUrl()
): SecureDocumentInitParameters {
  return {
    url: source,
    // PDF JavaScript actions are never executed.
    enableScripting: false,
    // Bundled CMap binaries are `.bcmap`; this is the 6.x default and is set
    // explicitly because `useWorkerFetch` gates on it being truthy.
    cMapUrl: pdfAssetUrl('cmaps', assetBaseUrl),
    cMapPacked: true,
    standardFontDataUrl: pdfAssetUrl('standard_fonts', assetBaseUrl),
    wasmUrl: pdfAssetUrl('wasm', assetBaseUrl),
    iccUrl: pdfAssetUrl('iccs', assetBaseUrl)
    // `useWorkerFetch` is intentionally omitted — see the module comment.
  }
}
