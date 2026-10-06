# Moving off pdfjs-dist 3.x

Planning document. No upgrade has been performed; this records what a move would
require and what currently blocks it, so the decision can be made deliberately
instead of discovered during an install.

Current state: `pdfjs-dist@3.11.174` (exact pin, plus an `overrides` entry) and
`@react-pdf-viewer/{core,page-navigation,search,zoom}@3.12.0`.
Open advisory accepted in `security/audit-exceptions.json`: `CVE-2024-4367`
mitigated by `isEvalSupported: false`, entry expires **2026-12-31**.

Everything under "verified" was read out of the installed packages and this
repository. Anything that could not be checked offline is called out as such.

## Blockers

### 1. The viewer cannot accept pdfjs 4.x/5.x

`@react-pdf-viewer/core@3.12.0` declares:

```json
"peerDependencies": { "pdfjs-dist": "^2.16.105 || ^3.0.279" }
```

`^3.0.279` is `>=3.0.279 <4.0.0`, so 4.x and 5.x are outside the range, and there
is no `peerDependenciesMeta` escape hatch. The plugin packages do not declare
`pdfjs-dist` at all; they depend on `@react-pdf-viewer/core@3.12.0`.

The viewer also consumes the peer as CommonJS with no alternative path —
`@react-pdf-viewer/core/lib/cjs/core.js` contains exactly one reference,
`var PdfJsApi = require('pdfjs-dist')`, and the package publishes only `lib/cjs/`
with no `module` field.

**Consequence: the two cannot be moved independently.** Any pdfjs major bump
requires a viewer major bump in the same change. _Verified._

Whether a viewer release supporting pdfjs 4.x/5.x exists, and at what version,
**could not be verified** — this environment has no registry access.

### 2. `legacy-peer-deps=true` disables the peer guard

The repository's `.npmrc` contains exactly one line:

```
legacy-peer-deps=true
```

This is the most important operational finding. npm will install a
peer-incompatible tree **without raising `ERESOLVE`**, so the peer range that
makes blocker 1 non-negotiable is not enforced at install time. The only
remaining guard is `src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts`,
which fails _after_ a successful install and a successful build.

Removing the flag is not done here. It was added by a single commit with no
rationale in the message (`2617810`, "chore: add legacy-peer-deps to .npmrc"),
and the flag should be removed, or the coupling test widened, as part of the
migration commit itself.

#### What the flag is actually suppressing

Answered offline by walking all 1287 installed packages and checking every one of
their 226 non-optional `peerDependencies` against the version npm actually
resolved. Two are unsatisfied, and **neither is the PDF viewer**:

| Package                         | Declares peer      | Installed |
| ------------------------------- | ------------------ | --------- |
| `eslint-plugin-jsx-a11y@6.10.2` | `eslint@^3 … ^9`   | `10.5.0`  |
| `eslint-plugin-react@7.37.5`    | `eslint@^3 … ^9.7` | `10.5.0`  |

So the real cause is the eslint 10 pin — `overrides` already forces both plugins
to resolve `eslint` to `10.5.0`, but their _declared_ ranges still stop at 9.x,
and only this flag suppresses the resulting `ERESOLVE`. One further peer is
absent rather than unsatisfied: `app-builder-lib@26.15.3` peers
`electron-builder-squirrel-windows@26.15.3`.

`pdfjs-dist@3.11.174` satisfies the viewer's `^3.0.279` exactly, so the PDF
stack contributes nothing here.

**Consequence for the migration:** deleting `.npmrc` as step 1 below will fail
with an `ERESOLVE` naming eslint plugins, not PDF. That is expected and not a
pdf problem — resolve the eslint peers first (or keep the flag and add the CI
assertion the plan recommends instead), then change one variable at a time.

### 3. No wasm anywhere, and nowhere to put it

`node_modules/pdfjs-dist@3.11.174` ships `build/`, `cmaps/`, `standard_fonts/`,
`web/`, `legacy/`, `image_decoders/`, `types/`. It has **no `wasm/` directory**,
**no `.wasm` file** and **no `.mjs` file** anywhere in the tree. It also has no
`files` field, so the shipped surface is whatever the release pipeline globbed.

`package.json` `build.files` is `["dist/**/*"]`. The current build output contains
the worker (`dist/assets/pdf.worker.min-<hash>.js`) and **zero** `.bcmap`,
`.pfb`, `.ttf` or `.wasm` files.

A 4.x move therefore needs three coordinated changes: add the wasm assets to the
packaged output, point `wasmUrl` at them, and decide explicitly whether
`cMapUrl` / `standardFontDataUrl` should now be configured too.

Related: the app sets **none** of `cMapUrl`, `standardFontDataUrl`,
`useWorkerFetch` or `wasmUrl` anywhere. On 3.11.174 that happens to work, because
`build/pdf.js` resolves `useWorkerFetch` to falsy when those URLs are unset and
falls back to main-thread factories. It is an accident of the current defaults,
not a decision. _Verified for 3.x; 4.x defaults are unverified._

### 4. `enableScripting: false` cannot be set type-safely on 3.x

The flag exists in the 3.11.174 bundle (12 occurrences) but **only in the
annotation layer** — `_setDefaultPropertiesFromJS` and friends return early when
it is unset. `getDocument` never reads it and `pdf.worker.js` contains zero
occurrences, so on 3.x it is a runtime no-op.

It is also **absent from `DocumentInitParameters`**
(`types/src/display/api.d.ts` declares `isEvalSupported` at line 132 and no
`enableScripting`); the only declarations are on `AnnotationLayerParams` and
`AnnotationLayerBuilderOptions`.

So at the two call sites:

- `src/features/pdf/lib/renderPageToImage.ts` — `getDocument({...})` passes an
  object literal directly, so excess-property checking applies and
  `enableScripting` would need a cast.
- `src/features/pdf/ui/components/PdfViewerElement.tsx` — `transformDocParams`
  types against `PdfJs.GetDocumentParams` imported from **`@react-pdf-viewer/core`**,
  whose own declaration omits `isEvalSupported` too. It compiles today only
  because the return type is inferred, which drops object-literal freshness.

Conclusion: `isEvalSupported: false` stays as the CVE-2024-4367 mitigation on
both sites; `enableScripting` is added **during** the upgrade, where it both
becomes meaningful and type-checks.

### 5. The coupling test fails by design on any version bump

`src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts` hard-fails in
several places at once:

| Line    | Assertion                                                        |
| ------- | ---------------------------------------------------------------- |
| 43, 90  | `VIEWER_PEER_RANGE` must equal the viewer's declared range       |
| 52–60   | `pdfjs-dist` must be an exact version, not a range               |
| 62–66   | `overrides['pdfjs-dist']` must equal the dependency              |
| 68–83   | the installed version must satisfy the peer range                |
| 93–104  | `isEvalSupported: false` on both `getDocument` sites             |
| 106–113 | the worker must come from `pdfjs-dist` via the literal specifier |

This is intentional anti-accident drift protection and must be rewritten
deliberately during the migration, not deleted.

## What is not a blocker

- **Deprecated pdf.js APIs.** There is **no `@deprecated` tag anywhere** in
  `pdfjs-dist@3.11.174`'s type surface. Migration risk here is not
  deprecation-driven.
- **`isEvalSupported` behavior.** Genuinely honoured end to end on 3.11.174:
  read at `pdf.js:929`, forwarded at 987 and 998, enforced at the eval gate at
  6197, with 31 further references in `pdf.worker.js`.
- **Module format interop.** The CJS/ESM shim at `renderPageToImage.ts:118-119`
  is the only place that needs attention, and `src/types/assets.d.ts` already
  declares a catch-all `declare module '*?url'`, so a renamed worker specifier
  still type-checks.
- **Main process.** `electron/` and `shared/` contain no pdfjs references at
  all; nothing about the PDF asset path is served or rewritten there.

## Files a migration would touch

Blocking:

- `package.json` — the two exact pins, the four viewer versions, `build.files`
- `package-lock.json` — regenerated
- `.npmrc` — blocker 2
- `src/features/pdf/ui/components/PdfWorkerHost.tsx` — worker specifier
- `src/features/pdf/lib/renderPageToImage.ts` — worker specifier, CJS/ESM shim,
  `getDocument` params
- `src/features/pdf/ui/components/PdfViewerElement.tsx` — `transformGetDocumentParams`,
  `enableScripting`
- `src/types/assets.d.ts` — the literal worker declaration becomes dead
- `src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts` — blocker 5
- `security/audit-exceptions.json` — `installed` version, advisory ids, expiry
- `vite.config.mts` — `vendor-pdf` chunking and the `EVAL` warning filter
- `src/__tests__/architecture/security-gate-wiring.test.ts` — pins
  `installed: '3.11.174'` and the advisory id

Re-verification required, not necessarily edits:

- `src/features/pdf/lib/pdfViewerDom.ts` — five selectors were read out of
  `core@3.12.0`'s own bundle; a viewer major bump invalidates all of them and
  silently breaks text extraction, selection, pan and capture
- `src/features/pdf/lib/activePdfDocumentRegistry.ts` — hand-written structural
  mirror of `PDFDocumentProxy`, reached through `as never` /
  `as unknown as` casts that defeat compiler checking
- `src/features/pdf/errors/pdfRenderErrors.ts` — its markers were deliberately
  scoped to what 3.11.174 and core@3.12.0 actually emit
- Tests that `vi.mock('@react-pdf-viewer/core', …)` against 3.12.0's exports

## Recommendation

1. **Before starting:** make the invariant enforced rather than merely tested
   after the fact. The cheapest option is a CI step asserting the installed
   pdfjs version satisfies the viewer's peer range, which needs no install-semantics
   change and cannot be broken by the eslint peers. Deleting `.npmrc` is the
   stronger option, but resolve the two eslint plugin peers first — otherwise the
   install fails on eslint and looks like a PDF regression.
2. **Then:** treat viewer + pdfjs as one atomic change. Check the registry for a
   viewer release whose `pdfjs-dist` peer range covers 4.x before planning
   further; if none exists, replacing the viewer is a prerequisite, not a
   follow-up.
3. **Size it as a viewer migration, not a dependency bump.** The work is
   dominated by the DOM adapter, the document-proxy mirror and packaging — not by
   the version number.
4. **Keep `isEvalSupported: false` throughout**, and add `enableScripting: false`
   in the same change that makes it meaningful.
