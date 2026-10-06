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
    // The switch must be a branch at the top level, not something buried inside
    // the legacy element where both paths would share state.
    expect(source).toMatch(/isNativeViewer \? \(/)
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
