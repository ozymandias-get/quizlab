/**
 * The circular-dependency gate, and the reason it used to be decorative.
 *
 * `npm run analyze:circular` runs madge over `src/ electron/ shared/`. For a
 * long time that command reported "No circular dependency found!" while
 * analysing **330 of 1073 files**: madge was given no `--ts-config`, so it could
 * not resolve a single `@app/* @shared/* @ui/* @features/* @platform/*
 * @shared-core/*` alias, and every aliased import landed in madge's `skipped`
 * list instead of the graph. The gate passed on a fraction of the tree and
 * nobody noticed, because madge reports skipped files only under `--warning`,
 * which the npm script does not pass, and never fails on them at all.
 *
 * Two things had to change for the gate to mean anything:
 *
 *  1. `.madgerc` now supplies `tsConfig`, which madge reads through `rc('madge')`
 *     (`madge/bin/cli.js:7` -> `node_modules/rc/index.js:44`, `cc.find('.madgerc')`).
 *     Skipped drops 330 -> 5, and the 5 are npm/CSS asset specifiers, not code.
 *  2. madge *cannot* be configured to fail on skipped files, so coverage is
 *     asserted here instead. This file resolves the whole graph the same way the
 *     CLI does and fails if any first-party alias is skipped, which is the state
 *     the CLI would otherwise report as success.
 *
 * It also splits type-only edges from runtime ones, which is what tells a real
 * cycle from a round-trip through type declarations. Both of the cycles this file
 * was written for were type-only — `shared/types/ipcContract.ts` imported the
 * `shared/types` barrel that re-exported it, and `useConfirmDialog` typed its
 * return value with a component's props from the layer above. Neither could bite
 * at runtime, but both were real layering damage and both are now gone.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

type MadgeResult = {
  obj(): Record<string, string[]>
  circular(): string[][]
  warnings(): { skipped: string[] }
}

type MadgeFactory = (srcPaths: string[], config: Record<string, unknown>) => Promise<MadgeResult>

const madge = require('madge/lib/api.js') as MadgeFactory

/** The roots `analyze:circular` passes on the command line. */
const ROOTS = ['src/', 'electron/', 'shared/'].map((root) => join(repoRoot, root))

/**
 * `precinct` forwards **only** `options[type]` to the detective
 * (`node_modules/precinct/index.js`: `detective(ast, options[type])`), and `type`
 * is the extension here. A top-level `skipTypeImports` is silently ignored —
 * which is exactly how a "runtime only" run can quietly return the type-only
 * graph instead and report cycles that do not exist.
 */
const SKIP_TYPE_IMPORTS = {
  ts: { skipTypeImports: true },
  tsx: { skipTypeImports: true }
}

interface MadgeConfig {
  tsConfig?: string
  fileExtensions?: string[]
  detectiveOptions?: Record<string, unknown>
  /** Set by `rc` to the config file it actually loaded, if any. */
  config?: string
}

const tsconfig = JSON.parse(
  readFileSync(join(repoRoot, 'tsconfig.json'), 'utf-8').replaceAll(/^\s*\/\/.*$/gm, '')
) as { compilerOptions?: { paths?: Record<string, string[]> } }

/** The alias prefixes the renderer codebase declares, e.g. `@app/` from `@app/*`. */
const ALIAS_PREFIXES = Object.keys(tsconfig.compilerOptions?.paths ?? {}).map((pattern) =>
  pattern.replace(/\*$/, '')
)

function firstPartyAlias(specifier: string): boolean {
  return ALIAS_PREFIXES.some((prefix) => specifier.startsWith(prefix))
}

/**
 * Reads madge's own config channel the way the CLI does, so this file asserts
 * the configuration that ships rather than a copy of it that could drift.
 * `rc('madge')` is the loader (`madge/bin/cli.js:7`); a missing `.madgerc` is a
 * hard failure rather than a fallback to defaults.
 */
function readMadgeConfig(): MadgeConfig {
  const rc = require('rc')('madge', {}, []) as MadgeConfig
  return rc
}

describe('circular gate: madge resolves the whole tree', () => {
  let full: MadgeResult
  let runtimeOnly: MadgeResult
  let madgeConfig: MadgeConfig

  beforeAll(async () => {
    madgeConfig = readMadgeConfig()
    const base = {
      tsConfig: madgeConfig.tsConfig
        ? join(repoRoot, madgeConfig.tsConfig)
        : (undefined as unknown as string),
      fileExtensions: madgeConfig.fileExtensions ?? ['ts', 'tsx', 'js', 'jsx']
    }
    full = await madge(ROOTS, base)
    runtimeOnly = await madge(ROOTS, { ...base, detectiveOptions: SKIP_TYPE_IMPORTS })
  }, 300_000)

  it('reads its tsConfig from .madgerc, which is the channel madge actually reads', () => {
    // `madge/bin/cli.js` merges `rc('madge')` with `package.json#madge` and then
    // lets truthy CLI flags win. `.madge.json` is not one of them — that file was
    // dead config, deleted in caab598.
    expect(madgeConfig.config).toBeDefined()
    expect(madgeConfig.tsConfig).toBe('tsconfig.json')
  })

  it('skips no first-party import, so the graph covers the tree', () => {
    // The regression this file exists for. 330 aliased specifiers were skipped
    // before `.madgerc`; only npm packages and CSS assets may be skipped now.
    const skippedFirstParty = full.warnings().skipped.filter(firstPartyAlias)
    expect(skippedFirstParty).toEqual([])
  })

  it('skips almost nothing at all', () => {
    // A floor rather than an exact count: what remains are third-party asset
    // specifiers (tailwindcss, pdf worker, font imports), which madge is not
    // meant to chase. A jump into the hundreds means alias resolution broke again.
    expect(full.warnings().skipped.length).toBeLessThan(20)
  })

  it('analyses the whole first-party tree, not a fraction of it', () => {
    expect(Object.keys(full.obj()).length).toBeGreaterThan(1000)
  })

  it('finds no cycle at all, type-only edges included', () => {
    // This is the assertion `npm run analyze:circular` makes; restating it here
    // keeps the test suite and the npm script from disagreeing.
    expect(full.circular()).toEqual([])
  })

  it('finds no cycle in the runtime graph either', () => {
    // The runtime graph drops `import type`, so it is the one that reflects what
    // the bundler actually links. Both were empty; keeping both asserted is what
    // makes "type-only vs runtime" a measured distinction rather than a claim.
    expect(runtimeOnly.circular()).toEqual([])
  })

  it('really does drop type-only edges in the runtime graph', () => {
    // If `detectiveOptions` were mis-shaped, the runtime graph would be a copy of
    // the full one and the assertion above would prove nothing. This pins that
    // the two graphs differ.
    const runtimeEdges = Object.values(runtimeOnly.obj()).reduce((n, deps) => n + deps.length, 0)
    const fullEdges = Object.values(full.obj()).reduce((n, deps) => n + deps.length, 0)
    expect(runtimeEdges).toBeLessThan(fullEdges)
  })
})
