/**
 * Configuration gate for the dead-code and architecture analysers.
 *
 * Three failures motivated this file, and none of them is visible from the
 * tooling's own output:
 *
 *  - **knip could not see `scripts/**`.** A script that nothing referenced was
 *    therefore not "unused", it was simply outside the analysis: knip only
 *    reached the `scripts/*.mjs` files because package.json happens to name
 *    them in `scripts`, and the hand-written `.d.mts` declarations were not in
 *    scope at all. Putting `scripts/**` in `project` without listing those
 *    declarations as entries swaps the blind spot for a guaranteed false
 *    positive per declaration, because the declarations are consumed through
 *    the `.mjs` specifier (`../../../scripts/check-audit.mjs`) and knip does not
 *    map a declaration file back to the module it describes.
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
 *    an unrelated package's transitive shape. Whether any `scripts/**` file still
 *    imports something package.json does not declare is now left entirely to
 *    `analyze:knip` — `scripts/**` is in its `project`, so an undeclared import
 *    there is reported as an unlisted dependency and fails the CI step. This file
 *    no longer re-derives it from the script text.
 *
 * A related one lives in `package.json`: `analyze:architecture` quoted
 * `--do-not-follow 'node_modules'`, and npm runs scripts through cmd.exe on
 * Windows, where single quotes are not syntax. The literal `'node_modules'`
 * matched nothing, so dependency-cruiser followed the whole of node_modules —
 * 4068 modules instead of 1142 — and the graph it validated was not the graph
 * the config describes.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

/**
 * The file names in `scripts/` with a given extension, read from disk.
 *
 * The two lists this file guards used to be hand-maintained enumerations, and a
 * gate added without adding its name to the right one left its rule not
 * covering it — green, with nothing anywhere to say so. That is the quiet
 * vacuity `security-gate-wiring.test.ts` documents at length, so the
 * enumerations are derived from the directory instead, and the test below
 * asserts the read produced something rather than trusting it.
 *
 * `readdirSync` throws if the directory is missing, so the failure that matters
 * is not "unreadable" but "empty": a `scripts/` with nothing in it would leave
 * both rules checking nothing while reporting nothing wrong.
 */
const scriptsIn = (extension: string): string[] =>
  readdirSync(join(ROOT, 'scripts'))
    .filter((name) => name.endsWith(extension))
    .sort()

/** Every `scripts/*.mjs`. knip analyses them all, so every one must be reached. */
const SCRIPT_NAMES = scriptsIn('.mjs')

/**
 * Every hand-written `scripts/*.d.mts`. These belong to gate scripts whose
 * validation logic is unit tested: their type surface is part of what is under
 * test, so dropping one would break `tsc -b` rather than a test.
 */
const DECLARATION_NAMES = scriptsIn('.d.mts')

/** `SCRIPT_NAMES` as the repo-relative paths the rules below compare against. */
const SCRIPT_PATHS = SCRIPT_NAMES.map((name) => `scripts/${name}`)

/**
 * The scripts nothing reaches: not named by a package.json script, and not a
 * knip entry either.
 *
 * A function so it can be asserted in both directions. As an inline list filter
 * this rule could only be shown passing; split out, the negative case below
 * proves it rejects a script even when every real script is accounted for.
 */
const unreachableScripts = (paths: string[], commands: string[], entries: Set<string>): string[] =>
  paths.filter((path) => !commands.some((command) => command.includes(path)) && !entries.has(path))

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

/**
 * Splits the workflow into `- name:` delimited step blocks.
 */
const stepBlocks = (): string[] =>
  workflow.split(/\n(?=\s*- name:)/).filter((block) => block.includes('- name:'))

const stepNameOf = (block: string): string => /- name: (.+)/.exec(block)?.[1]?.trim() ?? ''

const stepNames = (): string[] => stepBlocks().map(stepNameOf).filter(Boolean)

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

  it('finds the scripts it is supposed to be guarding', () => {
    // Anti-vacuity guard for both derived lists. Without this, an empty read
    // would make the two rules below check nothing and pass — which is how a
    // list stops guarding anything without ever failing.
    expect(SCRIPT_NAMES.length).toBeGreaterThan(0)
    expect(DECLARATION_NAMES.length).toBeGreaterThan(0)
  })

  it('reaches every scripts/*.mjs through a package.json script or an entry', () => {
    expect(unreachableScripts(SCRIPT_PATHS, Object.values(scripts), entryPaths)).toEqual([])
  })

  it('the reachability rule reports a script that nothing reaches', () => {
    // Proves the rule above bites, so it cannot be satisfied by any list at
    // all. This is the case a hand-maintained list could not produce: the new
    // name simply is not there, and the rule quietly stops guarding that gate.
    const ghost = 'scripts/check-nothing-reaches-this.mjs'
    const commands = Object.values(scripts)
    expect(unreachableScripts([...SCRIPT_PATHS, ghost], commands, entryPaths)).toEqual([ghost])
  })

  it.each(DECLARATION_NAMES)('resolves %s instead of reporting it as unused', (name) => {
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

describe('npm scripts: no argument is single-quoted', () => {
  /**
   * npm runs scripts through cmd.exe on Windows, where a single quote is not
   * quoting — it is a literal character. The argument then reaches the tool with
   * its quotes attached, so a glob matches nothing and the tool silently reports
   * a different (usually wider) result than the same script produces under bash.
   *
   * `--do-not-follow 'node_modules'` was the instance that made the analyser
   * validate the wrong graph; `--ignore-files '**\/*.test.*'` was the instance
   * that made `analyze:types` exclude nothing and report 98.76% on Windows
   * against 99.75% on Linux, for the same tree. Both are invisible locally,
   * because the developer machine is the one shell that tolerates the quoting.
   *
   * Double quotes are correct in both shells, so the rule is simply: none.
   */
  it('leaves no script with a single-quoted argument', () => {
    const offenders = Object.entries(scripts)
      .filter(([, command]) => /'[^']*'/.test(command))
      .map(([name]) => name)
    expect(offenders).toEqual([])
  })

  it('still excludes the test globs, with double quotes that survive cmd.exe', () => {
    const command = scripts['analyze:types']
    for (const pattern of ['**/*.test.*', '**/*.spec.*', '**/__tests__/**']) {
      expect(command).toContain(`--ignore-files "${pattern}"`)
    }
  })
})

describe('CI: the dead-code gate is blocking and tolerance-free', () => {
  const KNIP_STEP = 'Dead Code (knip)'

  const knipStep = (): string => {
    const step = stepBlocks().find((block) => block.includes(`- name: ${KNIP_STEP}`))
    expect(step).toBeDefined()
    return step as string
  }

  /**
   * The provisioning steps of the `quality` job, and why they are in scope.
   *
   * This file no longer mirrors the whole step list. A hand-maintained list of
   * every CI step name is a duplicate of `.github/workflows/build.yml` that can
   * only ever report "someone changed the workflow" — so it went red on every
   * legitimate addition and taught everyone to ignore it. What is not derivable
   * from the workflow file itself is *which* gates are meant to be blocking,
   * and that is a decision, not a property. The rules below therefore cover:
   * this gate's own step, the tolerance flags that would silently disarm it,
   * and the Node floor the rest of the job is built on.
   */
  it('runs the analyser', () => {
    expect(stepNames()).toContain(KNIP_STEP)
    expect(knipStep()).toContain('npm run analyze:knip')
  })

  it('is blocking: the step carries no continue-on-error', () => {
    // The step used to be advisory while the tree carried the documented dead
    // code (11 unused exports, 48 unused exported types). That debt is gone, so
    // a softened step would now only hide regressions — the whole point of the
    // gate is that any finding fails the build.
    expect(knipStep()).not.toContain('continue-on-error')
  })

  it('runs knip bare, with no issue ceiling to regress against', () => {
    // The step used to be ratcheted at `knip --max-issues 59`, which turned
    // "there is dead code" into "the debt grew past 59" and let a nonzero
    // finding pass as green. `knip` alone exits 1 on any finding, which is the
    // only reading a gate should have.
    expect(scripts['analyze:knip']).toBe('knip')
  })

  it('no script anywhere hides a knip finding behind a tolerance', () => {
    // Catches the ceiling coming back on a differently-named script.
    const ratcheted = Object.entries(scripts).filter(([, command]) =>
      command.includes('--max-issues')
    )
    expect(ratcheted).toEqual([])
  })

  it('deadcode stays an alias of the same command', () => {
    expect(scripts['analyze:deadcode']).toBe('npm run analyze:knip')
  })

  it('the pre-flight gates this job is built on stay blocking', () => {
    // ubuntu-latest ships a preinstalled Node, so softening `Setup Node.js`
    // leaves CI running on whatever the image has, silently below the
    // `24.15.0` floor that `ci:check-declarations` exists to protect.
    for (const name of [
      'Setup Node.js',
      'Repository hygiene guard',
      'Version consistency',
      'Declaration consistency'
    ]) {
      const step = stepBlocks().find((block) => block.includes(`- name: ${name}`))
      expect(step, `workflow step not found: ${name}`).toBeDefined()
      expect(step).not.toContain('continue-on-error')
    }
  })
})
