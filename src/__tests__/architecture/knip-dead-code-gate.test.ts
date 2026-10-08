/**
 * Configuration gate for the dead-code and architecture analysers.
 *
 * Three failures motivated this file, and none of them is visible from the
 * tooling's own output:
 *
 *  - **knip could not see `scripts/**`.** A script that nothing referenced was
 *    therefore not "unused", it was simply outside the analysis: knip only
 *    reached the nine `scripts/*.mjs` files because package.json happens to name
 *    them in `scripts`, and the two hand-written `.d.mts` declarations were not
 *    in scope at all. Putting `scripts/**` in `project` without listing those
 *    declarations as entries swaps the blind spot for two guaranteed false
 *    positives, because the declarations are consumed through the `.mjs`
 *    specifier (`../../../scripts/check-audit.mjs`) and knip does not map a
 *    declaration file back to the module it describes.
 *  - **`@doyensec/electronegativity` was reported as an unused devDependency.**
 *    It is not unused. `scripts/check-electron-security.mjs` reads the
 *    package's own `package.json` to find its bin path and `spawnSync`s that
 *    path with `process.execPath`, because `node_modules/.bin/*.cmd` cannot be
 *    spawned on Node 22+. No static import exists, so no static analyser can see
 *    it. That makes an ignore the honest answer — but only if it stays pinned to
 *    the exact reason, which is what the assertions below do.
 *  - **`glob` was never declared.** `scripts/check-file-sizes.mjs` imported it and
 *    it resolved only because npm hoisted `glob@7` out of
 *    `@doyensec/electronegativity`'s dependency tree. A CI gate was leaning on
 *    an unrelated package's transitive shape.
 *
 * A related one lives in `package.json`: `analyze:architecture` quoted
 * `--do-not-follow 'node_modules'`, and npm runs scripts through cmd.exe on
 * Windows, where single quotes are not syntax. The literal `'node_modules'`
 * matched nothing, so dependency-cruiser followed the whole of node_modules —
 * 4068 modules instead of 1142 — and the graph it validated was not the graph
 * the config describes.
 */
import { existsSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import packageJson from '../../../package.json'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf-8')

interface KnipConfig {
  entry?: string[]
  project?: string[]
  ignoreDependencies?: string[]
  ignoreBinaries?: string[]
}

const knip = JSON.parse(read('knip.json')) as KnipConfig
const scripts = packageJson.scripts as Record<string, string>
const workflow = read('.github', 'workflows', 'build.yml')

const ELECTRON_SECURITY_GATE = read('scripts', 'check-electron-security.mjs')
const DEV_SCRIPT = read('scripts', 'dev.mjs')
const FILE_SIZE_GATE = read('scripts', 'check-file-sizes.mjs')

/**
 * The two gate scripts whose validation logic is unit tested, and so need a
 * declaration beside them. Their type surface is part of what is under test:
 * dropping either would break `tsc -b` rather than a test.
 */
const GATE_DECLARATIONS = ['check-audit.d.mts', 'check-electron-security.d.mts']

/**
 * Expands `{a,b}` alternations so an entry glob can be compared with a literal
 * path. Deliberately tiny and dependency-free: a test that imports a glob
 * library to check a glob library's configuration is the same mistake as the
 * hoisted `glob` above.
 */
const expandBraces = (pattern: string): string[] => {
  const alternation = /\{([^{}]*)\}/.exec(pattern)
  if (!alternation) return [pattern]
  const head = pattern.slice(0, alternation.index)
  const tail = pattern.slice(alternation.index + alternation[0].length)
  return alternation[1].split(',').flatMap((option) => expandBraces(head + option + tail))
}

const entryPaths = new Set((knip.entry ?? []).flatMap(expandBraces))

/** Splits the workflow into `- name:` delimited step blocks. */
const stepBlocks = (): string[] =>
  workflow.split(/\n(?=\s*- name:)/).filter((block) => block.includes('- name:'))

const stepNames = (): string[] =>
  stepBlocks()
    .map((block) => /- name: (.+)/.exec(block)?.[1]?.trim())
    .filter((name): name is string => Boolean(name))

/**
 * Every bare (non-relative) module specifier a script imports.
 *
 * A CI gate that runs on the build machine is production code for the purposes
 * of dependency hygiene: if it imports something package.json does not declare,
 * the build depends on whatever npm happened to hoist.
 */
const bareImports = (source: string): string[] =>
  [...source.matchAll(/(?:from|import|require)\s*\(?\s*'([^']+)'/g)]
    .map((match) => match[1])
    .filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('/'))
    .map((specifier) => specifier.replace(/^node:/, ''))
    .filter((specifier) => !builtinModules.includes(specifier))

/**
 * Asserts the gate script still reaches electronegativity the only way it
 * structurally can — by resolving its bin from its own manifest at runtime.
 *
 * This is the precondition for the knip ignore. If someone replaces the
 * `spawnSync` with a static import, this fails and the ignore must be deleted,
 * because knip would then see the dependency and the ignore would be hiding a
 * real signal.
 */
const expectDynamicResolution = (source: string) => {
  expect(source).toContain("'@doyensec'")
  expect(source).toContain("'electronegativity'")
  expect(source).toMatch(/readFileSync\(manifest, 'utf-8'\)/)
  expect(source).toMatch(/pkg\.bin/)
  expect(source).toMatch(/spawnSync\(\s*process\.execPath/)
  expect(source).not.toMatch(/^\s*import\s+.*@doyensec/m)
  expect(source).not.toMatch(/require\(\s*['"]@doyensec/)
}

describe('knip scope: the gate scripts are analysed, not merely present', () => {
  it('brings scripts/** into the analysed project', () => {
    // Without this, a script that nothing references is invisible rather than
    // reported, so dead tooling accumulates without a single finding.
    expect(knip.project).toContain('scripts/**/*.{mjs,mts}')
  })

  it('reaches every scripts/*.mjs through a package.json script or an entry', () => {
    const commands = Object.values(scripts)
    const unreached = [
      'dev',
      'build-electron',
      'check-audit',
      'check-electron-security',
      'check-file-sizes',
      'check-repo-hygiene',
      'check-semgrep',
      'check-type-coverage',
      'check-version-consistency'
    ]
      .map((name) => `scripts/${name}.mjs`)
      .filter(
        (path) => !commands.some((command) => command.includes(path)) && !entryPaths.has(path)
      )

    expect(unreached).toEqual([])
  })

  it.each(GATE_DECLARATIONS)('resolves %s instead of reporting it as unused', (name) => {
    // These are consumed through the sibling `.mjs` specifier, so knip never
    // links them. As project files without an entry they are reported unused —
    // a false positive that would either train people to ignore the report or
    // get the declarations deleted.
    expect(existsSync(join(ROOT, 'scripts', name))).toBe(true)
    expect(entryPaths.has(`scripts/${name}`)).toBe(true)
  })

  it('rejects a declaration file that is not an entry', () => {
    // Proves the rule above bites rather than passing vacuously.
    expect(entryPaths.has('scripts/check-semgrep.d.mts')).toBe(false)
  })
})

describe('knip: the electronegativity ignore is justified, not blanket', () => {
  it('ignores exactly one dependency, and it is the unresolvable one', () => {
    expect(knip.ignoreDependencies).toEqual(['@doyensec/electronegativity'])
  })

  it('ignores the Windows-only binary the dev script cannot declare', () => {
    // `taskkill` ships with Windows. There is no package to declare, and the
    // call site is guarded, so this is a knip limitation rather than a leak.
    expect(knip.ignoreBinaries).toEqual(['taskkill'])
    expect(DEV_SCRIPT).toMatch(/if \(process\.platform === 'win32'\) \{\s*spawn\('taskkill'/)
  })

  it('the ignored dependency is still reached, dynamically', () => {
    expectDynamicResolution(ELECTRON_SECURITY_GATE)
  })

  it('rejects a gate that imports the dependency statically', () => {
    // If this ever throws-free, knip can see the dependency and the ignore has
    // to go — the assertion above would then be hiding a working signal.
    const staticallyImported = ELECTRON_SECURITY_GATE.replace(
      /^\s*import \{ spawnSync \} from 'child_process'$/m,
      "import 'x'\nimport { spawnSync } from 'child_process'\nimport electronegativity from '@doyensec/electronegativity'"
    )
    expect(() => expectDynamicResolution(staticallyImported)).toThrow()
  })

  it('rejects an ignore list that has grown past the one justified entry', () => {
    const blanket = { ...knip, ignoreDependencies: ['@doyensec/electronegativity', 'react'] }
    expect(knip.ignoreDependencies).toEqual(
      knip.ignoreDependencies?.filter((name) => name === '@doyensec/electronegativity')
    )
    expect(blanket.ignoreDependencies).toHaveLength(2)
  })
})

describe('gate scripts declare every dependency they use', () => {
  it('the file-size gate imports nothing that package.json does not declare', () => {
    // This is the check that would have caught `glob`: it was resolvable only
    // through a hoisted transitive copy of glob@7, so the gate's behaviour
    // depended on an unrelated package's dependency shape.
    expect(bareImports(FILE_SIZE_GATE)).toEqual([])
  })

  it('the file-size gate discovers files with a Node built-in', () => {
    expect(FILE_SIZE_GATE).toMatch(/import \{ globSync, readFileSync \} from 'fs'/)
    expect(FILE_SIZE_GATE).toMatch(/globSync\(pattern, \{ exclude \}\)/)
  })

  it('the file-size gate still excludes tests, generated output and declarations', () => {
    for (const pattern of [
      '**/node_modules/**',
      '**/dist/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.d.ts'
    ]) {
      expect(FILE_SIZE_GATE).toContain(`'${pattern}'`)
    }
  })

  it.each([
    'scripts/check-audit.mjs',
    'scripts/check-semgrep.mjs',
    'scripts/check-type-coverage.mjs'
  ])('%s imports nothing undeclared', (path) => {
    expect(bareImports(read(path))).toEqual([])
  })
})

describe('dependency-cruiser: the --do-not-follow argument survives every shell', () => {
  /**
   * npm runs scripts through cmd.exe on Windows, where single quotes are not
   * syntax. A quoted pattern arrives at the tool with its quotes attached,
   * matches nothing, and the analyser silently widens the graph it validates.
   */
  const followArgument = (command: string): string | undefined =>
    /--do-not-follow\s+(\S+)/.exec(command)?.[1]

  it('passes the glob unquoted', () => {
    expect(followArgument(scripts['analyze:architecture'])).toBe('node_modules')
  })

  it('rejects the quoted form that npm leaves intact on Windows', () => {
    // Proves the extraction above is not trivially satisfied.
    expect(followArgument(`depcruise --do-not-follow 'node_modules' src`)).toBe("'node_modules'")
    expect(followArgument(`depcruise --do-not-follow 'node_modules' src`)).not.toBe('node_modules')
  })

  it('keeps the three source roots and the validation flags', () => {
    expect(scripts['analyze:architecture']).toContain('--validate')
    for (const root of ['src', 'electron', 'shared']) {
      expect(scripts['analyze:architecture']).toContain(` ${root}`)
    }
  })
})

describe('CI: the dead-code gate is visible without pinning the pipeline to it', () => {
  const KNIP_STEP = 'Dead Code (knip, advisory)'

  it('runs the analyser', () => {
    expect(stepNames()).toContain(KNIP_STEP)
    const step = stepBlocks().find((block) => block.includes(`- name: ${KNIP_STEP}`))
    expect(step).toContain('npm run analyze:knip')
  })

  it('is explicitly advisory rather than silently blocking', () => {
    // knip cannot be a hard gate while the tree carries the documented dead
    // code: today it reports 11 unused exports and 48 unused exported types,
    // and blocking on that fails every build including the ones that remove
    // some of it. The step is advisory so the debt stays visible.
    const step = stepBlocks().find((block) => block.includes(`- name: ${KNIP_STEP}`))
    expect(step).toContain('continue-on-error: true')
  })

  it('is named so a reader cannot mistake advisory for enforced', () => {
    expect(KNIP_STEP).toContain('advisory')
  })

  it('ratchets the analyser so a regression still shows up', () => {
    // `knip` alone exits 1 forever, which is indistinguishable from a working
    // gate. The ceiling turns "there is debt" into "the debt grew", and it is
    // deliberately the one number to re-baseline after a cleanup.
    expect(scripts['analyze:knip']).toMatch(/^knip --max-issues (\d+)$/)
    const baseline = Number(/--max-issues (\d+)/.exec(scripts['analyze:knip'])?.[1])
    expect(baseline).toBeGreaterThan(0)
  })

  it('deadcode stays an alias of the same command', () => {
    expect(scripts['analyze:deadcode']).toBe('npm run analyze:knip')
  })

  it('keeps the existing gates blocking', () => {
    // Making one of these advisory would be a silent weakening, which is the
    // failure mode these assertions exist to prevent.
    const blocking = [
      'Lint',
      'Format Check',
      'Typecheck',
      'Architecture (dependency-cruiser)',
      'CSS Lint',
      'Run Tests with Coverage',
      'Type Coverage (guard)',
      'Duplicate Code Detection',
      'Circular Dependency Check',
      'Semgrep (production sources)',
      'Production Dependency Audit',
      'Electron Hardening (Electronegativity)'
    ]
    const softened = blocking.filter((name) => {
      const step = stepBlocks().find((block) => block.includes(`- name: ${name}`))
      return step === undefined || step.includes('continue-on-error')
    })

    expect(softened).toEqual([])
  })
})
