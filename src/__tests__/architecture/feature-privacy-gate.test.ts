/**
 * Regression tests for the architecture gates themselves.
 *
 * Both gates have previously failed *silently*:
 *
 *   - a second `src` block in eslint.config.mjs redefined
 *     `no-restricted-imports` and dropped the feature-internal patterns (flat
 *     config replaces a rule wholesale), so the rule looked configured but
 *     never ran
 *   - `analyze:architecture` used `--output-type text`, which reports
 *     violations but always exits 0, so 358 pre-existing violations never
 *     failed a build
 *
 * These tests assert the gates are wired, not merely present.
 */
import { ESLint } from 'eslint'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'

import packageJson from '../../../package.json'

// The cruiser config is plain JS with no type declarations; load it as-is
// rather than widening `*.cjs` to `any` project-wide.
const require = createRequire(import.meta.url)
const depcruiseConfig = require('../../../.dependency-cruiser.cjs') as {
  forbidden: Array<{ name: string; from?: { pathNot?: string } }>
}

const FEATURE_DIRS = ['ai', 'pdf', 'settings', 'tutorial', 'screenshot', 'automation', 'onboarding']

/**
 * Loading the flat config pulls in every ESLint plugin, which is slow enough
 * to exceed the default per-test timeout when the suite runs in parallel.
 * Resolve everything once up front and assert on the cached results.
 */
const TIMEOUT = 120_000

describe('architecture gate: eslint feature-privacy rule', () => {
  let restricted: Record<string, string>
  let probe: Array<{ ruleId?: string | null; message: string }>
  let deepDynamic: Array<{ ruleId?: string | null; message: string }>
  let insideFeature: Array<{ ruleId?: string | null; message: string }>

  beforeAll(async () => {
    const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mjs' })

    const specifiersFor = async (filePath: string) => {
      const config = await eslint.calculateConfigForFile(filePath)
      const rule = config.rules['no-restricted-imports']
      const options = Array.isArray(rule) ? rule[1] : rule
      const patterns = (options as { patterns?: unknown[] } | undefined)?.patterns ?? []
      return JSON.stringify(patterns)
    }

    restricted = {
      app: await specifiersFor('src/app/App.tsx'),
      sharedUi: await specifiersFor('src/shared/ui/layout/LeftPanel.tsx'),
      sharedCore: await specifiersFor('shared/constants/ipcChannels.ts')
    }

    const lintProbe = async (code: string, filePath: string) => {
      const [result] = await eslint.lintText(code, { filePath })
      return result?.messages ?? []
    }

    probe = await lintProbe(
      [
        "import { useAiSender } from '@features/ai/hooks/useAiSender'",
        "import { usePrompts } from '@features/ai'",
        "const viewer = () => import('@features/pdf/viewer')",
        "import type { T } from '@features/pdf/types'",
        'export { useAiSender, usePrompts, viewer }',
        'export type { T }',
        ''
      ].join('\n'),
      'src/app/__gate_probe__.ts'
    )

    deepDynamic = await lintProbe(
      ["const s = () => import('@features/ai/store/chatUiStore')", 'export { s }', ''].join('\n'),
      'src/app/__gate_probe__.ts'
    )

    insideFeature = (
      await lintProbe(
        ["import { x } from '../hooks/useThing'", 'export { x }', ''].join('\n'),
        'src/features/pdf/ui/Thing.tsx'
      )
    ).filter((m) => m.ruleId === 'no-restricted-imports' || m.ruleId === 'no-restricted-syntax')
  }, TIMEOUT)

  it(
    'keeps the feature-internal pattern in the EFFECTIVE config for src/app',
    () => {
      expect(restricted.app).toContain('Feature internals are private')
    },
    TIMEOUT
  )

  it(
    'keeps it for src/shared too',
    () => {
      expect(restricted.sharedUi).toContain('Feature internals are private')
    },
    TIMEOUT
  )

  it(
    'keeps it for the top-level shared/ tree',
    () => {
      expect(restricted.sharedCore).toContain('Feature internals are private')
    },
    TIMEOUT
  )

  it(
    'does not drop the renderer electron ban when merging the blocks',
    () => {
      // The regression came from a second src block replacing the first.
      // Both concerns must coexist in one rule definition.
      expect(restricted.app).toContain('Renderer must not import Electron directly')
      expect(restricted.app).toContain('Do not use @src/* alias')
    },
    TIMEOUT
  )

  it(
    'restricts deep feature imports but not the barrel or approved entrypoints',
    () => {
      // The deep import must be rejected...
      const noRestrictedImports = probe.filter((m) => m.ruleId === 'no-restricted-imports')
      expect(noRestrictedImports).toHaveLength(1)
      expect(noRestrictedImports[0].message).toContain('@features/ai/hooks/useAiSender')
      // ...while the barrel and both approved sub-entrypoints stay clean.
      expect(probe.filter((m) => m.ruleId === 'no-restricted-syntax')).toHaveLength(0)
    },
    TIMEOUT
  )

  it(
    'rejects a deep dynamic import',
    () => {
      expect(deepDynamic.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true)
    },
    TIMEOUT
  )

  it(
    'does not restrict imports inside a feature itself',
    () => {
      expect(insideFeature).toHaveLength(0)
    },
    TIMEOUT
  )
})

describe('architecture gate: dependency-cruiser rules', () => {
  const forbidden = depcruiseConfig.forbidden
  const names = forbidden.map((rule) => rule.name)

  it('forbids app/ and shared/ from reaching into feature internals', () => {
    expect(names).toContain('app-no-feature-internals')
  })

  it('generates a cross-feature rule for every ordered pair', () => {
    const expected = FEATURE_DIRS.length * (FEATURE_DIRS.length - 1)
    const crossRules = names.filter((n) => n.startsWith('no-cross-feature-internals:'))
    expect(crossRules).toHaveLength(expected)
  })

  it('no longer forbids ordinary intra-feature imports', () => {
    // The old rule matched `from` and `to` on the same feature and produced
    // 368 false positives (ui/ importing model/, hooks/ importing lib/, ...).
    expect(names).not.toContain('no-teeny-uncrossable-boundaries')
  })

  it('keeps the pre-existing platform rules', () => {
    expect(names).toEqual(
      expect.arrayContaining([
        'no-circular',
        'shared-core-no-electron',
        'renderer-no-electron-direct',
        'electron-no-renderer',
        'no-nodejs-from-browser'
      ])
    )
  })

  it('does not hold third-party cycles against the build', () => {
    // A direct dependency is resolved into the graph even with
    // --do-not-follow, so an unscoped no-circular rule fails on a cycle inside
    // a vendored package. That is not actionable, and it would only teach
    // everyone to ignore this gate.
    const circular = depcruiseConfig.forbidden.find((rule) => rule.name === 'no-circular')
    expect(circular?.from?.pathNot).toMatch(/node_modules/)
  })
})

describe('architecture gate: analyze:architecture actually fails', () => {
  const script = (packageJson.scripts as Record<string, string>)['analyze:architecture']

  it('uses a reporter that propagates violations as a non-zero exit code', () => {
    // `text` (and json/dot/html/anon) print violations but always exit 0.
    // Only the default `err` reporter, or an explicit --output-type err,
    // makes dependency-cruiser fail the process.
    expect(script).not.toMatch(/--output-type (text|json|dot|ddot|html|anon|archi|flat|d2)\b/)
  })

  it('passes --validate so violations are treated as errors', () => {
    expect(script).toContain('--validate')
  })
})
