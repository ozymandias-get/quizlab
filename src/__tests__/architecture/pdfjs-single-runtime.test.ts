/**
 * The PDF runtime is **single**, and this file is what keeps it that way.
 *
 * ## Why this file exists in this shape
 *
 * For most of the migration there were two PDF.js runtimes installed on purpose —
 * `pdfjs-dist@3.11.174` under `@react-pdf-viewer` (the shipped viewer) and
 * `pdfjs-dist@6.4.299` under the `pdfjs-6` alias (the native viewer) — and this
 * file's predecessor pinned the relationship between them. Most of that contract
 * was negative: *these two must never mix, this alias must not be hijacked, this
 * chunk must stay separate from that one.*
 *
 * With one runtime every one of those negatives is either gone or has become a
 * positive. An assertion that "the alias is not overridden" is meaningless when
 * there is no alias. So this file is rewritten around what is left:
 *
 *  - the invariants that describe the **architecture** rather than the migration —
 *    engine purity, the boundary that may import it, the security posture, asset
 *    staging, the markup contract — all preserved
 *  - a **positive** statement of the collapse: one package, one version, one
 *    worker, one viewer, zero RPV. Those are the properties a future dependency
 *    bump or a well-meaning "let's also try RPV for the annotations" could
 *    silently undo, and nothing else in the tree would notice.
 *
 * The exit plan this implements is the Phase 3B one in
 * `docs/pdfjs-migration-plan.md`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import packageJson from '../../../package.json'

const require = createRequire(import.meta.url)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const pdfFeatureDir = join(repoRoot, 'src/features/pdf')
const engineDir = join(pdfFeatureDir, 'engine')

/** The one runtime the whole app is allowed to have. */
const PDFJS_VERSION = '6.4.299'

/** Everything under `src/`, for the "no production import" sweeps. */
function productionFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      out.push(...productionFiles(full))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

/** Repo-relative path to an absolute one, for the literal file references below. */
const repoPath = (relativePath: string): string => join(repoRoot, relativePath)

const readSource = (absolutePath: string): string => readFileSync(absolutePath, 'utf-8')

/**
 * A source file's code with its comment lines removed.
 *
 * Module notes legitimately name `@react-pdf-viewer` and `pdfjs-6` while
 * explaining why they are gone; only code is under assertion here.
 */
const codeOf = (absolutePath: string): string =>
  readSource(absolutePath)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
    .join('\n')

/** All production `.ts`/`.tsx` under `src/features/pdf`. */
const pdfProductionFiles = productionFiles(pdfFeatureDir)

/** The only files permitted to import the engine. */
const ENGINE_IMPORTERS = [
  'src/features/pdf/native/useNativePdfEngine.ts',
  'src/features/pdf/native/useNativePdfRender.ts',
  'src/features/pdf/native/useNativePdfCaptureDocument.ts',
  // Capture's temporary document load. It needs a PDF.js document but is not
  // viewer code, so it is allowed the engine's capture adapter and nothing else.
  'src/features/pdf/lib/renderPageToImage.ts'
]

const dependencies = packageJson.dependencies as Record<string, string>
const overrides = (packageJson.overrides ?? {}) as Record<string, unknown>
const viteConfig = readSource(repoPath('vite.config.mts'))

/* ------------------------------------------------------------- dependencies */

describe('single runtime: one PDF.js dependency', () => {
  it('declares pdfjs-dist at the canonical version, exactly', () => {
    expect(dependencies['pdfjs-dist']).toBe(PDFJS_VERSION)
  })

  it('has no second PDF.js under any name', () => {
    // `pdfjs-6` was the migration alias. Anything else here means a second copy
    // on disk, which is the exact failure the whole dual runtime existed to avoid.
    const pdfjsPackages = Object.keys(dependencies).filter((name) => /(^|-)pdfjs/.test(name))
    expect(pdfjsPackages).toEqual(['pdfjs-dist'])
  })

  it('has removed every @react-pdf-viewer package', () => {
    const rpvPackages = Object.keys(dependencies).filter((name) =>
      name.startsWith('@react-pdf-viewer')
    )
    expect(rpvPackages).toEqual([])
  })

  it('installs exactly one pdfjs-dist on disk', async () => {
    const installed = JSON.parse(
      readFileSync(join(repoRoot, 'node_modules/pdfjs-dist/package.json'), 'utf-8')
    ) as { name: string; version: string }
    expect(installed.name).toBe('pdfjs-dist')
    expect(installed.version).toBe(PDFJS_VERSION)
    // The alias used to leave a second physical directory behind.
    expect(readdirSync(join(repoRoot, 'node_modules')).some((e) => e === 'pdfjs-6')).toBe(false)
  })

  it('no longer overrides pdfjs-dist, so no pin can diverge from the direct dependency', () => {
    // The override existed to hold 3.11.174 in place for RPV. Left behind it would
    // silently force a different version than the one the app declares.
    expect(overrides['pdfjs-dist']).toBeUndefined()
  })

  it('declares no audit exception for a runtime that no longer ships', () => {
    // CVE-2024-4367 / GHSA-wgrm-67xf-hhpq affects `pdfjs-dist <=4.1.392`.
    // 6.4.299 is outside that range, so the finding is fixed rather than
    // mitigated. `check-audit.mjs` fails an exception whose advisory is no longer
    // reported, so a leftover entry would break the gate rather than sit quietly.
    const exceptions = JSON.parse(
      readFileSync(join(repoRoot, 'security/audit-exceptions.json'), 'utf-8')
    ) as { exceptions: Array<{ package: string }> }
    expect(exceptions.exceptions.map((e) => e.package)).not.toContain('pdfjs-dist')
  })
})

/* ------------------------------------------------------------ import purity */

describe('single runtime: no legacy import survives in production code', () => {
  it('no production file imports @react-pdf-viewer', () => {
    const offenders = pdfProductionFiles
      .filter((file) => /(?:from\s+|import\(|require\()\s*['"]@react-pdf-viewer/.test(codeOf(file)))
      .map((file) => relative(repoRoot, file))
    expect(offenders).toEqual([])
  })

  it('no production file imports the pdfjs-6 alias', () => {
    const offenders = pdfProductionFiles
      .filter((file) => /['"]pdfjs-6(?:\/|['"])/.test(codeOf(file)))
      .map((file) => relative(repoRoot, file))
    expect(offenders).toEqual([])
  })

  it('no production file imports the pdf.js web viewer', () => {
    // PDF.js's own `PDFView` / `PDFFindController` / `PDFLinkService` live in
    // `pdfjs-dist/web/pdf_viewer.mjs`, which is the entire web viewer: it wants
    // the DOM, an event bus, and its own page views. QuizLab supplies its own
    // page view, so importing it would pull a second viewer in behind the one.
    const offenders = pdfProductionFiles
      .filter((file) => /pdfjs-dist\/web\//.test(codeOf(file)))
      .map((file) => relative(repoRoot, file))
    expect(offenders).toEqual([])
  })

  it('no production file emits an rpv-* class', () => {
    // The native viewer's stylesheets match `data-native-pdf-*` only. A class from
    // a deleted viewer in production code would be markup nothing styles.
    const offenders = pdfProductionFiles
      .filter((file) => /['"`]rpv-/.test(codeOf(file)))
      .map((file) => relative(repoRoot, file))
    expect(offenders).toEqual([])
  })

  it('no shared stylesheet still carries an rpv-* selector', () => {
    const stylesheets = [
      ...productionFiles(join(repoRoot, 'src/shared/styles')),
      ...pdfProductionFiles
    ]
    const offenders = stylesheets
      .filter((file) => /\.css$/.test(file) && /\.rpv-/.test(readFileSync(file, 'utf-8')))
      .map((file) => relative(repoRoot, file))
    expect(offenders).toEqual([])
  })
})

/* ---------------------------------------------------------------- the worker */

describe('single runtime: one worker', () => {
  it('the engine imports the 6.x ESM worker', () => {
    expect(codeOf(repoPath('src/features/pdf/engine/pdfWorker.ts'))).toMatch(
      /from 'pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url'/
    )
  })

  it('nothing imports the 3.x worker file', () => {
    // `pdf.worker.min.js` was RPV's worker and does not exist in 6.x any more.
    const offenders = pdfProductionFiles
      .filter((file) => /pdf\.worker\.min\.js/.test(codeOf(file)))
      .map((file) => relative(repoRoot, file))
    expect(offenders).toEqual([])
  })

  it('publishes the worker URL in exactly one place', () => {
    const writers = pdfProductionFiles
      .filter((file) =>
        /\.assign\(\s*GlobalWorkerOptions\.workerSrc|GlobalWorkerOptions\.workerSrc\s*=/.test(
          codeOf(file)
        )
      )
      .map((file) => relative(repoRoot, file))
    expect(writers).toEqual(['src\\features\\pdf\\engine\\pdfWorker.ts'])
  })
})

/* ------------------------------------------------------------ engine purity */

describe('single runtime: the engine boundary', () => {
  const engineFiles = readdirSync(engineDir).filter((f) => f.endsWith('.ts'))

  it('the engine has no React, UI, zustand or viewer dependency', () => {
    const banned =
      /from ['"](react|react-dom|zustand|@features\/pdf\/(native|ui)|@app\/|@shared\/ui)/
    const offenders = engineFiles.filter((file) =>
      banned.test(codeOf(`src/features/pdf/engine/${file}`))
    )
    expect(offenders).toEqual([])
  })

  it('only the declared boundary may import the engine', () => {
    const offenders = pdfProductionFiles
      .filter((file) => !ENGINE_IMPORTERS.includes(relative(repoRoot, file).replaceAll('\\', '/')))
      .filter((file) => /from ['"]@features\/pdf\/engine/.test(codeOf(file)))
      .map((file) => relative(repoRoot, file).replaceAll('\\', '/'))
    expect(offenders).toEqual([])
  })

  it('resolves the text layer through pdfjs-dist, never the removed renderTextLayer', () => {
    // `renderTextLayer()` was deleted in 4.x; `TextLayer` replaced it as a class.
    const code = codeOf(repoPath('src/features/pdf/native/useNativePdfTextLayer.ts'))
    expect(code).toMatch(/import\s*\{[^}]*TextLayer[^}]*\}\s*from 'pdfjs-dist'/)
    expect(code).not.toContain('renderTextLayer')
  })

  it('resolves the annotation layer from the package entry point', () => {
    const code = codeOf(repoPath('src/features/pdf/native/useNativePdfAnnotationLayer.ts'))
    expect(code).toMatch(/import\s*\{[^}]*AnnotationLayer[^}]*\}\s*from 'pdfjs-dist'/)
  })
})

/* ---------------------------------------------------------- security posture */

describe('single runtime: scripting stays disabled', () => {
  it('the document options disable PDF scripting', () => {
    const code = codeOf(repoPath('src/features/pdf/engine/pdfDocumentOptions.ts'))
    expect(code).toContain('enableScripting: false')
  })

  it('the annotation layer refuses scripting, forms and JS actions', () => {
    const code = codeOf(repoPath('src/features/pdf/native/useNativePdfAnnotationLayer.ts'))
    expect(code).toContain('enableScripting: false')
    expect(code).toContain('hasJSActions: false')
    expect(code).toContain('renderForms: false')
  })

  it('does not pass isEvalSupported anywhere', () => {
    // Removed in PDF.js 4.x — there is no such option to set. Its presence would
    // mean a stale 3.x-shaped call site, and its absence is why the CVE-2024-4367
    // exception is no longer needed.
    const offenders = pdfProductionFiles
      .filter((file) => /isEvalSupported/.test(codeOf(file)))
      .map((file) => relative(repoRoot, file))
    expect(offenders).toEqual([])
  })

  it('routes external link targets through the app openExternal bridge', () => {
    const code = codeOf(repoPath('src/features/pdf/native/nativePdfLinkService.ts'))
    expect(code).toContain('openExternal')
    expect(code).not.toMatch(/window\.open|location\.href/)
  })
})

/* ------------------------------------------------------------------- assets */

describe('single runtime: asset staging', () => {
  const ASSET_SUBDIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const

  it('the engine declares the four asset directories', () => {
    expect(readSource(repoPath('src/features/pdf/engine/pdfDocumentOptions.ts'))).toContain(
      `['cmaps', 'standard_fonts', 'wasm', 'iccs']`
    )
  })

  it('every declared asset directory exists in the installed package', () => {
    const packageRoot = dirname(require.resolve('pdfjs-dist/package.json', { paths: [repoRoot] }))
    for (const subdir of ASSET_SUBDIRS) {
      expect(
        readdirSync(join(packageRoot, subdir)).length,
        `${subdir} is empty in the installed pdfjs-dist`
      ).toBeGreaterThan(0)
    }
  })

  it('ships the wasm decoders that 3.x never had', () => {
    const packageRoot = dirname(require.resolve('pdfjs-dist/package.json', { paths: [repoRoot] }))
    const wasm = readdirSync(join(packageRoot, 'wasm'))
    expect(wasm.some((file) => file.endsWith('.wasm'))).toBe(true)
  })

  it('reads them from node_modules/pdfjs-dist, not the retired alias', () => {
    expect(viteConfig).toContain("const PDFJS_PACKAGE = 'node_modules/pdfjs-dist'")
    expect(viteConfig).not.toContain('node_modules/pdfjs-6')
  })
})

/* ------------------------------------------------------------------- chunks */

describe('single runtime: one PDF chunk', () => {
  it('emits a single vendor-pdf chunk', () => {
    expect(viteConfig).toContain("return 'vendor-pdf'")
    expect(viteConfig).toContain("test: /pdfjs-dist/, name: 'vendor-pdf'")
  })

  it('has no legacy or native chunk name left', () => {
    expect(viteConfig).not.toContain('vendor-pdf-legacy')
    expect(viteConfig).not.toContain('vendor-pdf-native')
  })

  it('does not special-case the deleted viewer in the chunk rules', () => {
    expect(viteConfig).not.toContain('@react-pdf-viewer')
  })
})

/* -------------------------------------------------------------- search layer */

describe('single runtime: the search overlay keeps its own vocabulary', () => {
  it('never reuses a class from the deleted viewer', () => {
    expect(codeOf(repoPath('src/features/pdf/native/nativePdfSearch.ts'))).not.toContain(
      'rpv-search__'
    )
  })

  it('leaves the highlight fade-in defined once, in the global sheet', () => {
    // `nativePdfSearchLayer.css` references this keyframe rather than
    // redeclaring it. If the global definition were removed with the RPV rules the
    // highlight would animate to nothing and the regression would be silent.
    const globalStyles = readSource(repoPath('src/shared/styles/modules/_pdf-viewer.css'))
    expect(globalStyles).toContain('@keyframes pdf-highlight-fadein')
    expect(codeOf(repoPath('src/features/pdf/native/nativePdfSearch.ts'))).toContain(
      'pdf-highlight-fadein'
    )
  })
})

/* ------------------------------------------------------------------ registry */

describe('single runtime: the capture registry has one producer', () => {
  it('accepts handles only, with no raw-proxy compatibility shim', () => {
    // It used to take either a real handle or a pdfjs-3 proxy normalized through
    // `legacyPdfCaptureDocument`, because RPV handed over `DocumentLoadEvent#doc`
    // verbatim. That dual shape is gone, so a caller that is not a handle must not
    // be able to register silently.
    const code = codeOf(repoPath('src/features/pdf/lib/activePdfDocumentRegistry.ts'))
    expect(code).not.toContain('legacyPdfCaptureDocument')
    expect(code).not.toContain('toCaptureHandle')
  })

  it('capture resolves no PDF.js runtime of its own', () => {
    // Capture borrows the viewer's document, or loads one through the engine.
    // Reaching `pdfjs-dist` directly here would be a second `getDocument`
    // options path, which is the thing the engine exists to prevent.
    const code = codeOf(repoPath('src/features/pdf/lib/renderPageToImage.ts'))
    expect(code).not.toMatch(/from ['"]pdfjs-dist['"]/)
    expect(code).not.toMatch(/import\(['"]pdfjs-dist['"]\)/)
    expect(code).not.toContain('getDocument(')
  })

  it('capture loads its temporary document through the engine capture adapter', () => {
    expect(codeOf(repoPath('src/features/pdf/lib/renderPageToImage.ts'))).toContain(
      "from '@features/pdf/engine/captureDocument'"
    )
  })
})

/* ------------------------------------------------------------------ the flag */

describe('single runtime: no feature flag remains', () => {
  it('no production file reads VITE_NATIVE_PDF_VIEWER', () => {
    const offenders = productionFiles(join(repoRoot, 'src')).filter((file) =>
      /VITE_NATIVE_PDF_VIEWER|isNativePdfViewerEnabled|readNativePdfViewerFlag/.test(codeOf(file))
    )
    expect(offenders).toEqual([])
  })

  it('renders the native viewer unconditionally', () => {
    const code = codeOf(repoPath('src/features/pdf/ui/components/PdfViewerDocument.tsx'))
    expect(code).toContain('<NativePdfViewer')
    expect(code).not.toContain('PdfViewerElement')
    expect(code).not.toContain('import.meta.env')
  })

  it('no longer mounts a viewer-scoped PDF worker host', () => {
    const code = codeOf(repoPath('src/shared/ui/layout/LeftPanel.tsx'))
    expect(code).not.toContain('PdfWorkerHost')
  })
})
