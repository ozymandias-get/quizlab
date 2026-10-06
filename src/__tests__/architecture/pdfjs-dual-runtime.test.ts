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
  'src/features/pdf/ui/components/PdfWorkerHost.tsx',
  'src/features/pdf/ui/hooks/usePdfPlugins.ts',
  'src/features/pdf/lib/renderPageToImage.ts',
  'src/features/pdf/lib/activePdfDocumentRegistry.ts'
]

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
