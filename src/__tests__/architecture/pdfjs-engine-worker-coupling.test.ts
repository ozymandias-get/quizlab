/**
 * pdfjs-dist is pinned deliberately.
 *
 * The coupling is easy to misdiagnose, so state it precisely: there is one
 * engine and one worker, both from the same package.
 *
 *   - `@react-pdf-viewer/core` lists `pdfjs-dist` as a peerDependency and its
 *     bundle does `require('pdfjs-dist')` — it runs the copy npm installed, it
 *     does not bundle its own PDF.js.
 *   - `PdfWorkerHost` hands that engine a worker URL built from the same npm
 *     `pdfjs-dist` package.
 *   - `renderPageToImage` imports the same package, and prefers the viewer's
 *     already-loaded `PDFDocumentProxy` over loading its own document.
 *
 * Because engine and worker come from one dependency, the invariant that matters
 * is the *peer range*: the installed pdfjs-dist has to satisfy the range the
 * viewer declares, and it must be an exact pin so a routine `npm install` cannot
 * move the worker out from under the engine while `npm audit` reported the tree
 * clean. That is what the tests below assert.
 *
 * Migrating means moving the viewer and pdfjs in one change, which additionally
 * requires:
 *   - `enableScripting: false` (CVE-2026-16633); it does not replace
 *     `isEvalSupported: false` (CVE-2024-4367), both are needed. Note 3.x
 *     honours the flag at runtime but its bundled `.d.ts` does not declare it
 *     on `GetDocumentParams`, so it cannot be set type-safely until the upgrade
 *   - packaging the `wasm/` assets (openjpeg/jbig2/qcms), absent in 3.x;
 *     the build only ships the dist directory
 *   - re-verifying the ESM interop shim in `renderPageToImage`
 *
 * These tests assert the invariant so the upgrade cannot happen by accident.
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

const declaredPdfjs = (packageJson.dependencies as Record<string, string>)['pdfjs-dist']
const overrides = (packageJson.overrides ?? {}) as Record<string, unknown>

describe('pdfjs engine/worker coupling', () => {
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

  it('disables eval-based scripting on every getDocument path', () => {
    // CVE-2024-4367 mitigation. `enableScripting: false` is for a different
    // CVE and does not cover this, so both are required. There are exactly two
    // sites that reach pdfjs: the viewer (through transformGetDocumentParams)
    // and the direct page render. Both must carry the flag, so assert both —
    // security/audit-exceptions.json names them as the mitigation.
    const viewerSource = readSource('../../features/pdf/ui/components/PdfViewerElement.tsx')
    expect(viewerSource).toContain('isEvalSupported: false')

    const renderSource = readSource('../../features/pdf/lib/renderPageToImage.ts')
    expect(renderSource).toContain('isEvalSupported: false')
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
