/**
 * The dual-runtime dependency invariant.
 *
 * ## Why two PDF.js versions are installed
 *
 * `@react-pdf-viewer@3.12.0` is not merely peer-incompatible with pdf.js 6 — it
 * is *runtime* incompatible. Its bundle calls `renderTextLayer()` and
 * `new SVGGraphics()`, both removed in pdf.js 4.x; `renderTextLayer` is on its
 * per-page text-layer hot path, so every page render would throw and both AI
 * text features ("send selection to AI", "send page text to AI") would die.
 *
 * So the migration deliberately installs both:
 *
 *   - `pdfjs-dist@3.11.174` — legacy, consumed by `@react-pdf-viewer`
 *   - `pdfjs-6` (alias of `pdfjs-dist@6.4.299`) — the native engine's runtime
 *
 * The invariant is that they never converge and never cross: the viewer must
 * keep resolving `pdfjs-dist`, the engine must keep resolving `pdfjs-6`, and
 * nothing may make one consume the other.
 *
 * ## When this file should be deleted
 *
 * Together with the exit plan in `docs/pdfjs-migration-plan.md`: when the
 * viewer is removed, `pdfjs-6` becomes `pdfjs-dist`, and this whole test file
 * goes with it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import packageJson from '../../../package.json'

const require = createRequire(import.meta.url)

const LEGACY_VERSION = '3.11.174'
const NATIVE_VERSION = '6.4.299'
const NATIVE_ALIAS = 'npm:pdfjs-dist@6.4.299'

const readJson = (relativePath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(require.resolve(relativePath), 'utf-8')) as Record<string, unknown>

const repoRoot = path.dirname(require.resolve('../../../package.json'))

const dependencies = packageJson.dependencies as Record<string, string>
const overrides = (packageJson.overrides ?? {}) as Record<string, unknown>

/** Every file under the native engine, so the boundary check sees them all. */
function engineSourceFiles(dir = path.join(repoRoot, 'src/features/pdf/engine')): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...engineSourceFiles(full))
    else if (/\.tsx?$/.test(entry.name)) files.push(full)
  }
  return files
}

/** Production sources outside the engine that must not reach for the alias. */
const LEGACY_VIEWER_SOURCES = [
  'src/features/pdf/ui/components/PdfViewerElement.tsx',
  'src/features/pdf/ui/components/PdfViewerDocument.tsx',
  'src/features/pdf/ui/components/PdfWorkerHost.tsx',
  'src/features/pdf/ui/hooks/usePdfPlugins.ts',
  'src/features/pdf/lib/renderPageToImage.ts',
  'src/features/pdf/lib/activePdfDocumentRegistry.ts'
]

/**
 * The native viewer's boundary: the only production files allowed to import
 * `@features/pdf/engine`.
 *
 * Phase 3B asserted the engine's own purity (no React, no UI, no DOM). Phase 4
 * adds the other half of the direction — UI *may* import the engine, and only
 * from here. Keeping the consumer list explicit means "who pulls pdfjs 6 into the
 * bundle" is answerable without a graph walk, and it fails loudly if a future
 * viewer feature reaches for the engine from somewhere unexpected.
 */
const NATIVE_VIEWER_BOUNDARY_DIR = path.join(repoRoot, 'src/features/pdf/native')
const NATIVE_VIEWER_COMPONENT = path.join(
  repoRoot,
  'src/features/pdf/ui/components/NativePdfViewer.tsx'
)

/**
 * A file's code with its comment lines removed.
 *
 * Several checks below are about things a module note legitimately *mentions* — the
 * removed `renderTextLayer`, the web bundle the annotation layer deliberately does not
 * import, the unsafe URL schemes the link service refuses. Only the code may be held
 * to those, exactly as elsewhere in this file.
 */
function codeOf(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf-8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
    .join('\n')
}
function pdfSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...pdfSourceFiles(full))
    else if (/\.tsx?$/.test(entry.name)) files.push(full)
  }
  return files
}

describe('dual-runtime dependency graph', () => {
  it('keeps the legacy pdfjs-dist on an exact pin for the viewer', () => {
    expect(dependencies['pdfjs-dist']).toBe(LEGACY_VERSION)
  })

  it('keeps the legacy override on the same exact version', () => {
    expect(overrides['pdfjs-dist']).toBe(LEGACY_VERSION)
  })

  it('adds pdfjs-6 as an exact alias of pdfjs-dist 6.x', () => {
    expect(dependencies['pdfjs-6']).toBe(NATIVE_ALIAS)
    // No range characters, or a routine install could drift the native runtime.
    expect(dependencies['pdfjs-6']).not.toMatch(/[\^~*]|latest/)
  })

  it('does not let the legacy override hijack the native alias', () => {
    // npm's `overrides` matches by dependency name. If it ever started matching
    // the aliased package, the native runtime would silently fall back to 3.x
    // and the whole isolation premise would be silently false.
    expect(overrides['pdfjs-6']).toBeUndefined()
  })

  it('installs two distinct pdfjs versions on disk', () => {
    const legacy = (readJson('pdfjs-dist/package.json') as { version: string }).version
    const native = (readJson('pdfjs-6/package.json') as { version: string }).version

    expect(legacy).toBe(LEGACY_VERSION)
    expect(native).toBe(NATIVE_VERSION)
  })

  it('resolves the alias to pdfjs-dist, so there is one upstream package', () => {
    const aliasEntry = (readJson('pdfjs-6/package.json') as { name: string }).name
    expect(aliasEntry).toBe('pdfjs-dist')
  })

  it('still satisfies the viewer peer range on the legacy runtime', () => {
    // Deliberately kept: it is the invariant that keeps the *legacy* half of the
    // migration honest, and it is unaffected by the alias.
    expect(LEGACY_VERSION).toMatch(/^3\./)
  })
})

describe('import boundary', () => {
  it('never imports the legacy pdfjs-dist from the native engine', () => {
    const offenders: string[] = []
    for (const file of engineSourceFiles()) {
      const source = readFileSync(file, 'utf-8')
      if (/from\s+['"]pdfjs-dist['"]/.test(source)) {
        offenders.push(path.relative(repoRoot, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('resolves every engine pdfjs import through the pdfjs-6 alias', () => {
    const imports: string[] = []
    for (const file of engineSourceFiles()) {
      const source = readFileSync(file, 'utf-8')
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        if (match[1].startsWith('pdfjs')) imports.push(match[1])
      }
    }

    expect(imports.length).toBeGreaterThan(0)
    expect(imports.every((specifier) => specifier.startsWith('pdfjs-6'))).toBe(true)
  })

  it('keeps the shipped viewer on the legacy runtime', () => {
    for (const relative of LEGACY_VIEWER_SOURCES) {
      const source = readFileSync(path.join(repoRoot, relative), 'utf-8')
      expect(source, relative).not.toContain("from 'pdfjs-6'")
      expect(source, relative).not.toContain('from "pdfjs-6"')
    }
  })

  it('leaves the legacy viewer worker on the 3.x asset', () => {
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/ui/components/PdfWorkerHost.tsx'),
      'utf-8'
    )
    expect(source).toMatch(/from 'pdfjs-dist\/build\/pdf\.worker\.min\.js\?url'/)
    expect(source).toContain('workerUrl={pdfjsWorkerUrl}')
  })

  it('gives the native engine the 6.x worker asset', () => {
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/engine/pdfWorker.ts'),
      'utf-8'
    )
    expect(source).toMatch(/from 'pdfjs-6\/build\/pdf\.worker\.min\.mjs\?url'/)
  })
})

describe('native viewer boundary', () => {
  it('confines engine imports to the native viewer boundary', () => {
    // Everything that reaches pdfjs 6 has to live in one directory plus one
    // presentational component, so deleting the migration is a directory delete.
    const allowed = new Set([
      ...pdfSourceFiles(NATIVE_VIEWER_BOUNDARY_DIR),
      NATIVE_VIEWER_COMPONENT
    ])
    const offenders: string[] = []
    for (const file of pdfSourceFiles(path.join(repoRoot, 'src/features/pdf'))) {
      if (allowed.has(file)) continue
      const source = readFileSync(file, 'utf-8')
      if (/from\s+['"]@features\/pdf\/engine/.test(source)) {
        offenders.push(path.relative(repoRoot, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('actually consumes the engine, so the dependency is not merely permitted', () => {
    // The other direction of the same invariant: a boundary that nobody enters
    // would pass the check above while the native worker stayed out of the build.
    const consumers = pdfSourceFiles(NATIVE_VIEWER_BOUNDARY_DIR).filter((file) =>
      /from\s+['"]@features\/pdf\/engine/.test(readFileSync(file, 'utf-8'))
    )
    expect(consumers.length).toBeGreaterThan(0)
  })

  it('keeps react-pdf-viewer types out of the native viewer boundary', () => {
    // The native path must not depend on the package it replaces — not even for
    // a type. `SpecialZoomLevel` in particular has no numeric counterpart there,
    // which is why the native path computes a fit scale instead.
    //
    // Only real import specifiers count: the boundary's comments legitimately
    // name the package they are deliberately not using.
    const importPattern = /(?:from\s+|import\()\s*['"]@react-pdf-viewer/
    const offenders: string[] = []
    for (const file of [...pdfSourceFiles(NATIVE_VIEWER_BOUNDARY_DIR), NATIVE_VIEWER_COMPONENT]) {
      if (importPattern.test(readFileSync(file, 'utf-8'))) {
        offenders.push(path.relative(repoRoot, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('resolves the text layer through pdfjs-6 and never the removed renderTextLayer', () => {
    // Phase 5 mounted PDF.js's `TextLayer` class. `renderTextLayer()` is the
    // pre-4.x function `@react-pdf-viewer` still calls and the reason Phase 3 was
    // blocked; if it ever reappears in the native path the same breakage returns.
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/useNativePdfTextLayer.ts'),
      'utf-8'
    )
    expect(source).toMatch(/from 'pdfjs-6'/)
    // Only the code counts; the module note legitimately names the removed API.
    const code = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
      .join('\n')
    expect(code).not.toContain('renderTextLayer')
    expect(code).not.toMatch(/from ['"]pdfjs-dist['"]/)
  })

  it('resolves the annotation layer through pdfjs-6, not the web viewer bundle', () => {
    // Phase 6 mounts PDF.js's `AnnotationLayer`, which *is* exported from `pdfjs-6`'s
    // entry point. The trap it invites is reaching for `pdfjs-6/web/pdf_viewer.mjs` to
    // get `PDFLinkService` alongside it: that module is the entire web viewer (page
    // views, history, find controller, scripting manager, sidebar, thumbnails), none
    // of which this single-page viewer can use — `PDFLinkService.goToDestination`
    // calls `PDFViewer#scrollPageIntoView`, so it is inoperable without one.
    //
    // So the annotation layer resolves `AnnotationLayer` from the bare alias and the
    // link surface is QuizLab's own adapter, and neither may import the web bundle.
    for (const file of pdfSourceFiles(NATIVE_VIEWER_BOUNDARY_DIR)) {
      expect(codeOf(file), path.relative(repoRoot, file)).not.toContain('pdfjs-6/web/')
    }

    const layer = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/useNativePdfAnnotationLayer.ts'),
      'utf-8'
    )
    expect(layer).toMatch(/import \{ AnnotationLayer \} from 'pdfjs-6'/)

    const linkService = codeOf(
      path.join(repoRoot, 'src/features/pdf/native/nativePdfLinkService.ts')
    )
    // The adapter may name `PDFDocumentProxy` — as a *type*, which is erased at build
    // time and so cannot drag a second runtime in — and nothing else from `pdfjs-6`.
    const pdfjsSpecifiers = [...linkService.matchAll(/from ['"](pdfjs[^'"]*)['"]/g)].map(
      (match) => match[1]
    )
    expect(pdfjsSpecifiers).toEqual(['pdfjs-6'])
    expect(linkService).toMatch(/import type \{[^}]*PDFDocumentProxy[^}]*\} from 'pdfjs-6'/)
    // And it must never construct the class it declines to use.
    expect(linkService).not.toContain('new PDFLinkService')
  })

  it('keeps scripting disabled on the annotation layer as well as the document', () => {
    // `enableScripting: false` in `pdfDocumentOptions` stops document-level actions.
    // This is the second half: it is also what keeps `LinkAnnotationElement` from
    // binding a JavaScript annotation action, which needs *both* `enableScripting` and
    // `hasJSActions`.
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/useNativePdfAnnotationLayer.ts'),
      'utf-8'
    )
    expect(source).toContain('enableScripting: false')
    expect(source).toContain('hasJSActions: false')
    // Forms are display-only for now, so a widget keeps the appearance the canvas
    // already painted instead of becoming an editable input.
    expect(source).toContain('renderForms: false')
  })

  it('routes external link targets through the app openExternal pathway', () => {
    // A PDF link must not be able to navigate the renderer. The annotation layer hands
    // the target to the same IPC the app's own "about" / "release notes" links use,
    // which re-validates the URL in the main process before `shell.openExternal` — and
    // it must not have grown a `window.open` or a `location.href` of its own.
    const source = codeOf(path.join(repoRoot, 'src/features/pdf/native/nativePdfLinkService.ts'))
    expect(source).toContain('openExternal')
    expect(source).not.toContain('window.open')
    expect(source).not.toContain('location.href')
    // The protocol allow-list mirrors the main process's, and is declared once rather
    // than inlined at the call site.
    expect(source).toContain('NATIVE_EXTERNAL_LINK_PROTOCOLS')
    expect(source).toContain("'https:'")
    expect(source).toContain("'mailto:'")
    // The unsafe schemes must not appear as an allow-list entry.
    for (const forbidden of ["'javascript:'", "'data:'", "'file:'", "'vbscript:'"]) {
      expect(source).not.toContain(forbidden)
    }
  })
  it('keeps the engine DOM-free now that a TextLayer exists in the boundary', () => {
    // `TextLayer` needs an `HTMLElement`, which is precisely why it lives in the
    // viewer boundary rather than in the engine. This is the assertion that keeps
    // that decision from quietly eroding: the engine must not grow the DOM
    // concern to make the text layer "fit" architecturally.
    //
    // The patterns name DOM *APIs*, not the word "document" — the engine has a
    // local parameter called `document` in `pageCache.ts`, which is the PDF
    // document proxy, not `globalThis.document`.
    const domApis = [
      /\bHTMLElement\b/,
      /\bdocument\.createElement\b/,
      /\bdocument\.querySelector/,
      /\bdocument\.addEventListener\b/,
      /\bglobalThis\.document\b/,
      /\bwindow\./,
      /\bTextLayer\b/,
      /\bgetSelection\b/
    ]
    for (const file of engineSourceFiles()) {
      const code = readFileSync(file, 'utf-8')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n')
      for (const api of domApis) {
        expect(code, path.relative(repoRoot, file)).not.toMatch(api)
      }
    }
  })

  it('keeps the native markup contract out of the legacy DOM adapter', () => {
    // Two runtimes, two DOM vocabularies. If the native attributes leaked into
    // `pdfViewerDom.ts` the legacy adapter would start matching markup it knows
    // nothing about, and the rule for "which page is this" would stop being
    // separable from the rendering one.
    const legacy = readFileSync(
      path.join(repoRoot, 'src/features/pdf/lib/pdfViewerDom.ts'),
      'utf-8'
    )
    expect(legacy).not.toContain('data-native-pdf')
    expect(legacy).not.toContain('@features/pdf/native')
    expect(legacy).not.toContain('@features/pdf/text')
  })

  it('does not fake an RPV class name anywhere in the native text path', () => {
    // The native layer has its own semantic attributes. Reusing
    // `rpv-core__text-layer` would let the legacy stylesheet silently restyle it
    // and would make the two markups indistinguishable in the extractors.
    //
    // Only quoted forms count, as elsewhere in this file: the boundary's comments
    // legitimately name the legacy class they are deliberately not emitting, and
    // a class name only becomes a selector when it is quoted.
    const files = [
      ...pdfSourceFiles(NATIVE_VIEWER_BOUNDARY_DIR),
      NATIVE_VIEWER_COMPONENT,
      path.join(repoRoot, 'src/features/pdf/text/pdfTextLayerSource.ts'),
      path.join(repoRoot, 'src/features/pdf/native/nativePdfTextLayer.css'),
      path.join(repoRoot, 'src/features/pdf/native/nativePdfAnnotationLayer.css')
    ]
    for (const file of files) {
      const source = readFileSync(file, 'utf-8')
      const relative = path.relative(repoRoot, file)
      expect(source, relative).not.toContain("'rpv-")
      expect(source, relative).not.toContain('"rpv-')
    }

    // And the positive half: the native contract names its own attributes.
    const nativeDom = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/nativePdfDom.ts'),
      'utf-8'
    )
    expect(nativeDom).toContain("'[data-native-pdf-canvas]'")
    expect(nativeDom).toContain('data-native-pdf-page')
    expect(nativeDom).toContain('data-native-pdf-text-layer')
    expect(nativeDom).toContain('data-native-pdf-text-page')
    expect(nativeDom).toContain('data-native-pdf-annotation-layer')
    expect(nativeDom).toContain('data-native-pdf-annotation-page')
  })

  it('scopes the native annotation stylesheet to its own attributes', () => {
    // Phase 6's CSS is a new surface: PDF.js's `.annotationLayer` rules transcribed
    // under `data-native-pdf-*`. Every rule must hang off the native layer attribute,
    // because an unscoped `.linkAnnotation` or `section` selector would restyle the
    // legacy `@react-pdf-viewer` markup in the same document.
    const css = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/nativePdfAnnotationLayer.css'),
      'utf-8'
    )
    expect(css).toContain('[data-native-pdf-annotation-layer]')
    // PDF.js's own class names are fine *under* the native attribute; the legacy
    // stylesheet's are not, and neither is `rpv-`. Only the quoted forms count, as
    // elsewhere in this file — the module note names the vocabulary it avoids.
    expect(css).not.toContain("'rpv-")
    expect(css).not.toContain('"rpv-')
  })

  it('emits no rpv- class name from the native viewer', () => {
    // The legacy viewer CSS is namespaced under `rpv-*`. Reusing those names would
    // make the stylesheet silently restyle the native canvas.
    for (const file of [...pdfSourceFiles(NATIVE_VIEWER_BOUNDARY_DIR), NATIVE_VIEWER_COMPONENT]) {
      expect(readFileSync(file, 'utf-8'), path.relative(repoRoot, file)).not.toContain("'rpv-")
      expect(readFileSync(file, 'utf-8'), path.relative(repoRoot, file)).not.toContain('"rpv-')
    }
  })

  it('keeps the feature flag off unless the exact opt-in value is present', () => {
    // The flag is the only thing standing between a stray deployment variable
    // and swapping the shipped PDF renderer.
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/nativePdfViewerFlag.ts'),
      'utf-8'
    )
    expect(source).toContain('VITE_NATIVE_PDF_VIEWER')
    expect(source).toMatch(/=== OPT_IN_VALUE/)
    // No loose truthiness: a non-string or an unset value must resolve to false.
    expect(source).toMatch(/typeof raw !== 'string'\) return false/)
  })

  it('switches the renderer at one place in the viewer shell', () => {
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/ui/components/PdfViewerDocument.tsx'),
      'utf-8'
    )
    expect(source).toContain('isNativePdfViewerEnabled')
    expect(source).toContain('<NativePdfViewer')
    expect(source).toContain('<PdfViewerElement')
    // The switch must be a branch at the top level, not something buried inside the
    // legacy element where both paths would share state.
    expect(source).toMatch(/isNativeViewer \? \(/)
  })
})

describe('native search boundary', () => {
  it('keeps the native search off the web viewer bundle, like the link service', () => {
    // The trap Phase 7 walks into is `PDFFindController`: it *is* exported from
    // `pdfjs-6/web/pdf_viewer.mjs`, and it is the obvious answer for "native search". Its
    // constructor calls `eventBus.on(...)` four times before it does anything else and it
    // publishes matches by dispatching `updatetextlayermatches` for a `PDFPageView` to
    // route back into — so it needs the whole web viewer, which this single-page viewer
    // does not have. The legacy path does not use it either: `@react-pdf-viewer/search`
    // walks the text layer's DOM itself. So the native search is QuizLab's own, built on
    // the same text layer the text extractors already read, and the web bundle stays out.
    for (const file of pdfSourceFiles(NATIVE_VIEWER_BOUNDARY_DIR)) {
      expect(codeOf(file), path.relative(repoRoot, file)).not.toContain('pdfjs-6/web/')
      expect(codeOf(file), path.relative(repoRoot, file)).not.toContain('PDFFindController')
      expect(codeOf(file), path.relative(repoRoot, file)).not.toContain('EventBus')
      expect(codeOf(file), path.relative(repoRoot, file)).not.toContain('PDFViewer')
    }

    // It resolves no pdfjs module at all: it needs text runs, and the text layer already
    // produced them. One less way for a second runtime to be dragged in.
    const search = codeOf(path.join(repoRoot, 'src/features/pdf/native/nativePdfSearch.ts'))
    expect(search).not.toMatch(/from ['"]pdfjs/)
    expect(search).toContain('document.createRange()')
  })

  it("emits its own highlight vocabulary, never the search plugin's class", () => {
    // `@react-pdf-viewer/search` ships `.rpv-search__highlight` and positions it with its
    // own stylesheet. Reusing that class would let the plugin's CSS style the native layer
    // and would make the two markups indistinguishable. So the native overlay is keyed on
    // `data-native-pdf-search-*` and the two visual properties it inherits from that
    // stylesheet are re-declared in the native one.
    for (const file of [...pdfSourceFiles(NATIVE_VIEWER_BOUNDARY_DIR), NATIVE_VIEWER_COMPONENT]) {
      expect(codeOf(file), path.relative(repoRoot, file)).not.toContain('rpv-search__highlight')
    }

    const css = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/nativePdfSearchLayer.css'),
      'utf-8'
    )
    expect(css).toContain('[data-native-pdf-search-layer]')
    expect(css).toContain('[data-native-pdf-search-highlight]')
    // The legacy plugin's own stylesheet must not be able to match the native overlay.
    expect(css).not.toContain("'rpv-")
    expect(css).not.toContain('"rpv-')

    const dom = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/nativePdfDom.ts'),
      'utf-8'
    )
    expect(dom).toContain("'[data-native-pdf-search-layer]'")
    expect(dom).toContain('data-native-pdf-search-highlight')
    expect(dom).toContain('data-native-pdf-search-page')
  })

  it('keeps the overlay inert to the pointer, above the canvas and below the links', () => {
    // Three separate requirements, and one stylesheet is the only place any of them can be
    // met: the overlay must not eat a selection or a `Ctrl+C`, it must not sit above the
    // annotation layer's link anchors, and it must paint above the canvas. `z-index: 1`
    // between the text layer's `0` and the annotation layer's `2` is what satisfies all
    // three at once.
    const css = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/nativePdfSearchLayer.css'),
      'utf-8'
    )
    const layerRule = css.slice(css.indexOf('[data-native-pdf-search-layer] {'))
    expect(layerRule).toContain('pointer-events: none')
    expect(layerRule).toContain('z-index: 1')
    const highlightRule = css.slice(css.indexOf('[data-native-pdf-search-highlight] {'))
    expect(highlightRule).toContain('pointer-events: none')
    expect(highlightRule).toContain('position: absolute')

    // The fade-in itself stays defined once, in the global stylesheet: the native overlay
    // only references the animation by name.
    const global = readFileSync(
      path.join(repoRoot, 'src/shared/styles/modules/_pdf-viewer.css'),
      'utf-8'
    )
    expect(global).toContain('@keyframes pdf-highlight-fadein')
    expect(css).not.toContain('@keyframes')
    expect(codeOf(path.join(repoRoot, 'src/features/pdf/native/nativePdfSearch.ts'))).toContain(
      'pdf-highlight-fadein var(--duration-normal) ease var(--duration-deliberate) forwards'
    )
    // Reduced motion is read per search run rather than cached in a second module-level
    // variable: the legacy cache stays where it is, at zero diff, and the native path has
    // nothing to invalidate because it measures once per query.
    const hook = codeOf(path.join(repoRoot, 'src/features/pdf/native/useNativePdfSearch.ts'))
    expect(hook).toContain('(prefers-reduced-motion: reduce)')
    // The legacy renderer is untouched: it keeps its own renderer, its own class and its
    // own reduced-motion cache.
    expect(
      readFileSync(path.join(repoRoot, 'src/features/pdf/ui/hooks/usePdfPlugins.ts'), 'utf-8')
    ).toContain('safeRenderHighlights')
  })

  it('searches the page it renders, and does not build a whole-document index', () => {
    // The legacy viewer runs `ViewMode.SinglePage`, so its plugin only ever highlights the
    // rendered page. A native whole-document index would extract every page's text in the
    // background to produce nothing a single-page viewer can show, and would grow the
    // memory footprint with page count. So nothing here walks pages: the search reads the
    // text layer that is mounted.
    const hook = codeOf(path.join(repoRoot, 'src/features/pdf/native/useNativePdfSearch.ts'))
    expect(hook).not.toContain('getTextContent')
    expect(hook).not.toContain('getPage')
    expect(hook).toContain('findNativeSearchTextLayer')

    const search = codeOf(path.join(repoRoot, 'src/features/pdf/native/nativePdfSearch.ts'))
    expect(search).not.toContain('getTextContent')
    // Literal matching: the keyword is compared, never compiled.
    expect(search).not.toMatch(/new RegExp/)
  })

  it('leaves the shared search UI renderer-agnostic', () => {
    // One `PdfSearchBar`, one `usePdfSearchStore`, one toolbar. The switch happens where
    // the renderer is chosen, so neither the bar nor the store can grow a native branch —
    // and neither is duplicated for the native path.
    for (const file of [
      'src/features/pdf/ui/components/PdfSearchBar.tsx',
      'src/features/pdf/ui/hooks/usePdfSearchStore.ts'
    ]) {
      const source = codeOf(path.join(repoRoot, file))
      expect(source, file).not.toContain('data-native-pdf')
      expect(source, file).not.toContain('VITE_NATIVE_PDF_VIEWER')
      expect(source, file).not.toContain('@features/pdf/native')
    }

    // And the native viewer keeps the flag off by default.
    const flag = readFileSync(
      path.join(repoRoot, 'src/features/pdf/native/nativePdfViewerFlag.ts'),
      'utf-8'
    )
    expect(flag).toMatch(/=== OPT_IN_VALUE/)
  })
})

describe('native security posture', () => {
  it('disables PDF JavaScript actions in the native document options', () => {
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/engine/pdfDocumentOptions.ts'),
      'utf-8'
    )
    expect(source).toContain('enableScripting: false')
  })

  it('keeps the legacy CVE-2024-4367 mitigation on the 3.x call sites', () => {
    // The legacy runtime is still shipped, so `isEvalSupported: false` must stay
    // on both 3.x getDocument paths until the viewer is gone.
    expect(
      readFileSync(
        path.join(repoRoot, 'src/features/pdf/ui/components/PdfViewerElement.tsx'),
        'utf-8'
      )
    ).toContain('isEvalSupported: false')
    expect(
      readFileSync(path.join(repoRoot, 'src/features/pdf/lib/renderPageToImage.ts'), 'utf-8')
    ).toContain('isEvalSupported: false')
  })

  it('does not carry the removed isEvalSupported knob into the native path', () => {
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/engine/pdfDocumentOptions.ts'),
      'utf-8'
    )
    // The identifier may only appear in prose explaining why it is absent.
    const code = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
      .join('\n')
    expect(code).not.toContain('isEvalSupported')
  })
})

describe('native runtime assets', () => {
  const ASSET_SUBDIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const

  it('declares the four directories the engine builds URLs for', () => {
    const source = readFileSync(
      path.join(repoRoot, 'src/features/pdf/engine/pdfDocumentOptions.ts'),
      'utf-8'
    )
    for (const subdir of ASSET_SUBDIRS) {
      expect(source).toContain(`'${subdir}'`)
    }
  })

  it('has every declared asset directory present in the installed pdfjs-6 package', () => {
    // Guards the URL builder against pointing at a directory that does not exist,
    // which would only fail at runtime on a document that happens to need it.
    const packageRoot = path.dirname(require.resolve('pdfjs-6/package.json'))
    for (const subdir of ASSET_SUBDIRS) {
      const dir = path.join(packageRoot, subdir)
      expect(readdirSync(dir).length, subdir).toBeGreaterThan(0)
    }
  })

  it('ships the 6.x wasm decoders that 3.x never had', () => {
    const packageRoot = path.dirname(require.resolve('pdfjs-6/package.json'))
    const wasm = readdirSync(path.join(packageRoot, 'wasm'))
    expect(wasm.some((file) => file.endsWith('.wasm'))).toBe(true)
  })

  it('stages the same directory list in the build config', () => {
    const config = readFileSync(path.join(repoRoot, 'vite.config.mts'), 'utf-8')
    for (const subdir of ASSET_SUBDIRS) {
      expect(config).toContain(`'${subdir}'`)
    }
    // And it must read the aliased package, not the legacy one.
    expect(config).toContain('node_modules/pdfjs-6')
  })

  it('keeps the two pdfjs runtimes in separate bundle chunks', () => {
    // If they were folded into one chunk, neither could be deleted later without
    // re-deriving what the other contains.
    const config = readFileSync(path.join(repoRoot, 'vite.config.mts'), 'utf-8')
    expect(config).toContain("'vendor-pdf-legacy'")
    expect(config).toContain("'vendor-pdf-native'")
  })
})
