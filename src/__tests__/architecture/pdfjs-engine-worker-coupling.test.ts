/**
 * The **legacy** PDF.js engine/worker coupling.
 *
 * Scope note: this file guards the `@react-pdf-viewer` half of the migration
 * only. The native engine's runtime and asset wiring are guarded by
 * `pdfjs-dual-runtime.test.ts`.
 *
 * The coupling is easy to misdiagnose, so state it precisely: there is one
 * engine and one worker, both from the same package.
 *
 *   - `@react-pdf-viewer/core` lists `pdfjs-dist` as a peerDependency and its
 *     bundle does `require('pdfjs-dist')` — it runs the copy npm installed, it
 *     does not bundle its own PDF.js.
 *   - `PdfWorkerHost` hands that engine a worker URL built from the same npm
 *     `pdfjs-dist` package.
 *
 * Phase 8A removed `renderPageToImage` from that set: capture's fallback document
 * load moved onto the native 6.x engine, so the capture module no longer resolves
 * `pdfjs-dist` at all. The coupling this file guards is now a single edge, and
 * that is progress rather than a loss — one runtime reaches capture instead of two.
 *
 * Because engine and worker come from one dependency, the invariant that matters
 * is the *peer range*: the installed pdfjs-dist has to satisfy the range the
 * viewer declares, and it must be an exact pin so a routine `npm install` cannot
 * move the worker out from under the engine while `npm audit` reported the tree
 * clean. That is what the tests below assert.
 *
 * ## Why the legacy pin is still 3.x while the native engine is on 6.x
 *
 * `@react-pdf-viewer@3.12.0` calls `renderTextLayer()` and `new SVGGraphics()`,
 * both removed in pdf.js 4.x. It cannot run on 6.x at all, so the legacy half of
 * the tree stays on 3.11.174 — with its `isEvalSupported: false` mitigation for
 * CVE-2024-4367 — until the viewer is deleted. Only then does the pin move.
 *
 * ## When this file should be deleted
 *
 * With the viewer: the peer-range rows become meaningless (there is no peer any
 * more), and `vendor-pdf-legacy` and `pdfjs-dist@3.11.174` disappear with it.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import packageJson from '../../../package.json'

const require = createRequire(import.meta.url)

/** Peer range declared by the pinned @react-pdf-viewer release we depend on. */
const VIEWER_PEER_RANGE = '^2.16.105 || ^3.0.279'

const readJson = (relativePath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(require.resolve(relativePath), 'utf-8')) as Record<string, unknown>

/** Reads a source file relative to this test, resolving its real extension. */
const readSource = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8')

/**
 * A source file's code with its comment lines removed.
 *
 * The capture module's own note explains at length why the 3.x knob is gone, and
 * that prose legitimately names it — only the code is under assertion here.
 */
const codeOf = (relativePath: string): string =>
  readSource(relativePath)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
    .join('\n')

const declaredPdfjs = (packageJson.dependencies as Record<string, string>)['pdfjs-dist']
const overrides = (packageJson.overrides ?? {}) as Record<string, unknown>

describe('legacy pdfjs engine/worker coupling', () => {
  it('keeps pdfjs-dist on an exact version, not a range', () => {
    // A caret here would let a routine `npm install` move the worker out from
    // under the viewer's bundled engine.
    expect(declaredPdfjs).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('pins pdfjs-dist through overrides as well', () => {
    // The direct dependency protects the app's own imports; the override
    // protects against a future transitive path resolving a second copy.
    expect(overrides['pdfjs-dist']).toBe(declaredPdfjs)
  })

  it('installs a pdfjs-dist that satisfies the viewer peer range', async () => {
    const semver = (await import('semver')).default

    const viewer = readJson('@react-pdf-viewer/core/package.json') as {
      peerDependencies?: Record<string, string>
    }
    const range = viewer.peerDependencies?.['pdfjs-dist']
    expect(range).toBeTruthy()

    const installed = (readJson('pdfjs-dist/package.json') as { version: string }).version

    expect(
      semver.satisfies(installed, range as string),
      `pdfjs-dist@${installed} does not satisfy the @react-pdf-viewer/core peer range ${range}.`
    ).toBe(true)
  })

  it('declares a peer range that matches the version we actually ship', () => {
    // Guards the constant in this file against the real manifest drifting.
    const viewer = readJson('@react-pdf-viewer/core/package.json') as {
      peerDependencies?: Record<string, string>
    }
    expect(viewer.peerDependencies?.['pdfjs-dist']).toBe(VIEWER_PEER_RANGE)
  })

  it('disables eval-based scripting on every legacy getDocument path', () => {
    // CVE-2024-4367 mitigation, and it is still load-bearing: the legacy runtime
    // really is 3.x, where the eval path exists and `enableScripting` does not
    // cover it. The 3.x call site must carry the flag —
    // security/audit-exceptions.json names it as the mitigation.
    //
    // Phase 8A removed the *second* call site rather than migrating it. Capture
    // used to `import('pdfjs-dist')` to temp-load a document when the registry had
    // nothing to lend; that load now goes through the native engine's
    // `PdfDocumentManager`, so `renderPageToImage.ts` no longer touches 3.x at all
    // and carries no `getDocument` of its own. The viewer is therefore the only
    // remaining 3.x `getDocument`, and the only one the exception needs to cover —
    // the exception entry itself stays until 3.11.174 leaves the tree.
    const viewerSource = readSource('../../features/pdf/ui/components/PdfViewerElement.tsx')
    expect(viewerSource).toContain('isEvalSupported: false')

    const renderCode = codeOf('../../features/pdf/lib/renderPageToImage.ts')
    expect(renderCode).not.toContain('isEvalSupported')
    expect(renderCode).not.toMatch(/from ['"]pdfjs-dist['"]/)
    expect(renderCode).not.toMatch(/import\(['"]pdfjs-dist['"]\)/)
  })

  it('serves the worker to the viewer from the npm pdfjs package', () => {
    // This is the fact that couples the versions. If the worker stops coming
    // from npm pdfjs-dist, the peer-range invariant above no longer protects
    // the engine and this test should be revisited rather than deleted.
    const source = readSource('../../features/pdf/ui/components/PdfWorkerHost.tsx')
    expect(source).toMatch(/from 'pdfjs-dist\/build\/pdf\.worker\.min\.js\?url'/)
    expect(source).toContain('workerUrl={pdfjsWorkerUrl}')
  })
})
