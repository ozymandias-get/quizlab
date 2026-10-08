/**
 * `src/shared` is the layer **below** `src/app`, and until this gate existed
 * nothing stopped it from reaching back up.
 *
 * The dependency was structural, not cosmetic: 22 runtime edges plus 4 type-only
 * ones, from 15 modules. `src/shared/hooks/useLocalStorage.ts` reached into the
 * composition root for a global `QueryClient` singleton; `src/shared/lib/
 * settingsSync.ts` did the same; the shared toast container, update banner,
 * bottom bar, left background and browser fallback all rendered inside app-owned
 * React contexts; and `ToolbarButton` — a primitive consumed by two features —
 * was built out of primitives that lived in `src/app/components/ui/`.
 *
 * Two gates hold the line, because each is blind where the other is not:
 *
 *  - **dependency-cruiser** (`shared-no-app`) sees the resolved graph, including
 *    dynamic `import()` edges and the type-only edges that only appear with
 *    `tsPreCompilationDeps: true`. With that option off the graph contained no
 *    `import type` edge at all: `shared/types/ipcContract.ts` had **zero**
 *    dependencies and `useConfirmDialog.ts` listed only `react`.
 *  - **eslint** (`no-restricted-imports` on `src/shared/**`) reports the offender
 *    in the editor, with the layer direction in the message.
 *
 * Both are asserted for *wiring*, not merely for presence, following the idiom in
 * `feature-privacy-gate.test.ts`: a second flat-config block that redefines
 * `no-restricted-imports` replaces the rule wholesale, so this file re-checks that
 * the patterns the sibling blocks hold are still in the effective config here.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

import packageJson from '../../../package.json'

const require = createRequire(import.meta.url)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const sharedRoot = join(repoRoot, 'src', 'shared')

interface Rule {
  name?: string
  from?: { path?: string; pathNot?: string }
  to?: { path?: string; pathNot?: string }
  severity?: string
}

const depcruiseConfig = require('../../../.dependency-cruiser.cjs') as {
  forbidden: Rule[]
  options: { tsPreCompilationDeps?: boolean }
}

const TIMEOUT = 120_000

/** Production `.ts`/`.tsx` under a directory; tests and assets skipped. */
function productionFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      out.push(...productionFiles(full))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name))
      out.push(full)
  }
  return out
}

const slashPath = (p: string): string => p.replaceAll('\\', '/')

describe('layer boundary: src/shared must not import the app shell', () => {
  const sharedFiles = productionFiles(sharedRoot)

  it('has production sources to check, so the sweep below is not vacuous', () => {
    // Assert the walk reaches real code before trusting a negative sweep.
    expect(sharedFiles.map((f) => slashPath(relative(repoRoot, f)))).toContain(
      'src/shared/hooks/useLocalStorage.ts'
    )
    expect(sharedFiles.length).toBeGreaterThan(50)
  })

  it('no production file under src/shared imports @app/', () => {
    // A source sweep, independent of both tools: if the rule is ever
    // misconfigured, this still reports the offender.
    const offenders = sharedFiles
      .filter((file) => /(?:from\s+|import\s*\()\s*['"]@app\//.test(readFileSync(file, 'utf-8')))
      .map((file) => slashPath(relative(repoRoot, file)))
    expect(offenders).toEqual([])
  })
})

describe('layer boundary: dependency-cruiser enforces it', () => {
  const names = depcruiseConfig.forbidden.map((rule) => rule.name)

  it('forbids src/shared from reaching src/app', () => {
    expect(names).toContain('shared-no-app')
  })

  it('scopes that rule to the shared → app direction', () => {
    const rule = depcruiseConfig.forbidden.find((r) => r.name === 'shared-no-app')
    expect(rule?.severity).toBe('error')
    expect(rule?.from?.path).toBe('^src/shared/')
    expect(rule?.to?.path).toBe('^src/app/')
  })

  it('keeps type-only edges in the graph', () => {
    // The reason this matters: with `tsPreCompilationDeps: false`, dependency-cruiser
    // resolves no `import type` edge whatsoever. 4 of the 26 original edges were
    // type-only and would have been invisible — the graph had 1131 modules /
    // 3548 edges, versus 1138 / 4200 with them on.
    expect(depcruiseConfig.options.tsPreCompilationDeps).toBe(true)
  })

  it('still holds the feature-privacy rules for src/shared', () => {
    // `shared-no-app` was added to an existing config; the earlier rules must not
    // have been traded away to make room for it.
    expect(names).toEqual(
      expect.arrayContaining([
        'no-circular',
        'app-no-feature-internals',
        'shared-core-no-electron',
        'renderer-no-electron-direct',
        'electron-no-renderer',
        'no-nodejs-from-browser'
      ])
    )
  })

  it('still passes --validate, so a violation fails the process', () => {
    const script = (packageJson.scripts as Record<string, string>)['analyze:architecture']
    expect(script).toContain('--validate')
    expect(script).not.toMatch(/--output-type (text|json|dot|ddot|html|anon|archi|flat|d2)\b/)
  })
})

describe('layer boundary: eslint enforces it', () => {
  let patternsForShared: string
  let staticProbe: Array<{ ruleId?: string | null; message: string }>
  let dynamicProbe: Array<{ ruleId?: string | null; message: string }>
  let featureInternalProbe: Array<{ ruleId?: string | null; message: string }>
  let barrelProbe: Array<{ ruleId?: string | null; message: string }>

  beforeAll(async () => {
    const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mjs' })

    const specifiersFor = async (filePath: string) => {
      const config = await eslint.calculateConfigForFile(filePath)
      const rule = config.rules['no-restricted-imports']
      const options = Array.isArray(rule) ? rule[1] : rule
      return JSON.stringify((options as { patterns?: unknown[] } | undefined)?.patterns ?? [])
    }
    patternsForShared = await specifiersFor('src/shared/hooks/useLocalStorage.ts')

    const lintProbe = async (code: string, filePath: string) => {
      const [result] = await eslint.lintText(code, { filePath })
      return result?.messages ?? []
    }

    staticProbe = await lintProbe(
      ["import { useToastActions } from '@app/providers'", 'export { useToastActions }', ''].join(
        '\n'
      ),
      'src/shared/hooks/__gate_probe__.ts'
    )
    dynamicProbe = await lintProbe(
      ["const p = () => import('@app/providers/queryClient')", 'export { p }', ''].join('\n'),
      'src/shared/hooks/__gate_probe__.ts'
    )
    featureInternalProbe = await lintProbe(
      [
        "import { useAiSender } from '@features/ai/hooks/useAiSender'",
        'export { useAiSender }',
        ''
      ].join('\n'),
      'src/shared/hooks/__gate_probe__.ts'
    )
    barrelProbe = await lintProbe(
      ["import { PdfViewer } from '@features/pdf'", 'export { PdfViewer }', ''].join('\n'),
      'src/shared/hooks/__gate_probe__.ts'
    )
  }, TIMEOUT)

  it('rejects a static @app/ import from src/shared', () => {
    const hits = staticProbe.filter((m) => m.ruleId === 'no-restricted-imports')
    expect(hits).toHaveLength(1)
    expect(hits[0].message).toContain('@app/')
  })

  it('rejects a dynamic @app/ import from src/shared', () => {
    // `no-restricted-imports` alone leaves `import('@app/...')` open, which is how
    // the lazy PDF viewer edge got in from src/shared in the first place.
    expect(dynamicProbe.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true)
  })

  it('still bans feature internals and the renderer electron import in src/shared', () => {
    // Flat config replaces a rule instead of merging options. The src/shared block
    // therefore has to repeat every pattern the src/** block declares; if it ever
    // stops doing so, one of these two assertions is what notices.
    expect(patternsForShared).toContain('Feature internals are private')
    expect(patternsForShared).toContain('Renderer must not import Electron directly')
    expect(patternsForShared).toContain('Do not use @src/* alias')
    expect(featureInternalProbe.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true)
  })

  it('still allows the public feature barrel and the approved entrypoints', () => {
    // The boundary is about reaching into *app*, not about banning features: a
    // shared module may use `@features/pdf` and `@features/pdf/viewer` exactly as
    // app may. LeftPanel depends on that today.
    expect(barrelProbe.filter((m) => m.ruleId === 'no-restricted-imports')).toHaveLength(0)
    expect(barrelProbe.filter((m) => m.ruleId === 'no-restricted-syntax')).toHaveLength(0)
  })
})
