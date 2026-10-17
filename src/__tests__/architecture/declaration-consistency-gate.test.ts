/**
 * Regression tests for the declaration consistency gate.
 *
 * The gate exists because two things in this repository were correct by
 * coincidence, and nothing said so:
 *
 *  - **The Node floor is stated six times.** `package.json` `engines.node`,
 *    `README.md`, `README_TR.md`, `CONTRIBUTING.md`, and the two
 *    `node-version` pins in `.github/workflows/build.yml`. Five of the six are
 *    prose, and no gate compared them. The floor is set by a transitive
 *    dependency (jsdom 30), so the next bump of *that* package moves the truth
 *    while every document keeps its old claim — a green build shipping six
 *    different answers, and a contributor told by the Turkish README to
 *    install a Node that CI does not use.
 *  - **"Declared floor == installed version" was unasserted.** `npm install`
 *    respects `package.json`, so `npm ci` is reproducible from the manifest
 *    alone. `npm update` does something else entirely: it rewrites only
 *    `package-lock.json`, inside the ranges already declared. The tree moves
 *    forward, the manifest does not, and nothing anywhere reports the gap.
 *    `npm outdated` shows the symptom a day later; this gate shows the cause.
 *
 * These assert the rules bite, not merely that a file exists. Each rule below
 * has a negative case that fails if the rule stops working, because this repo
 * has been bitten by the alternative: an `it.each` over an empty list stays
 * green while the rule it guarded is no longer being checked at all.
 */
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import packageJson from '../../../package.json'
import {
  admitsMajor,
  checkDeclaredFloors,
  checkNodeFloorAgreement,
  minimumVersion,
  rangeFloor
} from '../../../scripts/check-declaration-consistency.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf-8')

const GATE = join('scripts', 'check-declaration-consistency.mjs')
const WORKFLOW = read('.github', 'workflows', 'build.yml')
const NPM_SCRIPT = 'ci:check-declarations'
const CI_STEP = 'Declaration consistency'
const scripts = packageJson.scripts as Record<string, string>

/**
 * The three documents that state the floor in prose, named in the gate itself.
 * Written out as a literal rather than derived, so that a gate which silently
 * stopped checking one of them cannot make this list shrink to match.
 */
const DOC_NAMES = ['README.md', 'README_TR.md', 'CONTRIBUTING.md']

const realDocs = (): Record<string, string> =>
  Object.fromEntries(DOC_NAMES.map((name) => [name, read(name)]))

/** `engines.node` as the repository actually declares it. */
const ENGINES_NODE = packageJson.engines.node

/** The `major.minor` substring the documents are expected to carry. */
const FLOOR_LABEL = '24.15'

/** Splits the workflow into `- name:` delimited step blocks. */
const stepBlocks = (): string[] =>
  WORKFLOW.split(/\n(?=\s*- name:)/).filter((block) => block.includes('- name:'))

const blockFor = (stepName: string): string => {
  const block = stepBlocks().find((candidate) => candidate.includes(`- name: ${stepName}`))
  expect(block, `workflow step not found: ${stepName}`).toBeDefined()
  return block as string
}

/**
 * The blocking contract, as a function so it can be asserted in both
 * directions. Mirrors the argument used for the electronegativity ignore and the
 * audit-exception rules: a rule that is never shown rejecting anything may be
 * a rule that accepts everything.
 */
const expectBlocking = (step: string): void => {
  expect(step).not.toContain('continue-on-error')
}

/** The npm script has to run the gate and nothing else. */
const expectRunsTheGate = (command: string | undefined): void => {
  expect(command).toBe('node scripts/check-declaration-consistency.mjs')
}

describe('declaration gate: the Node floor is derived, never restated', () => {
  it('finds all three documents, so the per-document loop is not empty', () => {
    expect(DOC_NAMES).toHaveLength(3)
    for (const name of DOC_NAMES) expect(existsSync(join(ROOT, name))).toBe(true)
  })

  it('reads the floor out of package.json engines.node', () => {
    expect(ENGINES_NODE).toBeTruthy()
    expect(minimumVersion(ENGINES_NODE)).toBe('24.15.0')
    expect(FLOOR_LABEL).toBe(
      ENGINES_NODE?.split('||')
        .map((part) => part.trim())
        .map((part) => minimumVersion(part))
        .sort()[0]
        ?.replace(/\.\d+$/, '')
    )
  })

  it.each(DOC_NAMES)('%s states the derived floor', (name) => {
    // Each document is checked on its own, with the CI pin check left out
    // entirely, so a failure here is attributable to that document rather than
    // to whichever problem the aggregator happened to print first.
    const findings = checkNodeFloorAgreement({
      enginesNode: ENGINES_NODE,
      docs: { [name]: realDocs()[name] }
    })
    expect(findings).toEqual([])
  })

  it('reports nothing for the documents as they stand', () => {
    const findings = checkNodeFloorAgreement({ enginesNode: ENGINES_NODE, docs: realDocs() })
    expect(findings).toEqual([])
  })

  it('moves the expected substring when engines.node moves', () => {
    // Proves the floor is derived rather than hardcoded: same documents, a
    // different `engines.node`, and the expectation changes with it.
    const findings = checkNodeFloorAgreement({
      enginesNode: '^22.11.0 || >=26.0.0',
      docs: realDocs()
    })
    expect(findings).toHaveLength(3)
    expect(findings.join('\n')).toMatch(/22\.11/)
    for (const name of DOC_NAMES)
      expect(findings.join('\n')).toMatch(new RegExp(name.replace('.', '\\.')))
  })

  it('accepts the same documents once they state the new floor', () => {
    // The other direction, so the rule is not merely "always complain about 22.11".
    const docs = Object.fromEntries(
      DOC_NAMES.map((name) => [name, 'Requires Node.js 22.11+ or 26+.'])
    )
    expect(checkNodeFloorAgreement({ enginesNode: '^22.11.0 || >=26.0.0', docs })).toEqual([])
  })

  it('rejects a document that does not state the floor', () => {
    const docs = { ...realDocs(), 'README_TR.md': 'Node.js 20+ gerekir.' }
    const findings = checkNodeFloorAgreement({ enginesNode: ENGINES_NODE, docs })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatch(/README_TR\.md/)
    expect(findings[0]).toMatch(/24\.15/)
  })

  it('treats a document file that is missing as a finding, not a skip', () => {
    const findings = checkNodeFloorAgreement({
      enginesNode: ENGINES_NODE,
      docs: { 'README.md': null }
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatch(/README\.md/)
  })

  it('treats a missing engines.node as a finding, not a reason to skip the check', () => {
    const findings = checkNodeFloorAgreement({
      enginesNode: undefined,
      docs: realDocs(),
      workflow: WORKFLOW
    })
    expect(findings.join('\n')).toMatch(/engines\.node/)
  })

  it('reports a range whose minimum cannot be read instead of guessing one', () => {
    const findings = checkNodeFloorAgreement({ enginesNode: 'lts/*', docs: realDocs() })
    expect(findings.join('\n')).toMatch(/lts\/\*/)
  })
})

describe('declaration gate: the CI pin has to be a major the range admits', () => {
  it('reports nothing for build.yml as it stands', () => {
    const findings = checkNodeFloorAgreement({
      enginesNode: ENGINES_NODE,
      docs: {},
      workflow: WORKFLOW
    })
    expect(findings).toEqual([])
  })

  it.each([24, 26])('admits major %i', (major) => {
    expect(admitsMajor(ENGINES_NODE, major)).toBe(true)
  })

  it.each([22, 23, 25])('rejects major %i, which the range does not admit', (major) => {
    expect(admitsMajor(ENGINES_NODE, major)).toBe(false)
  })

  it('admits a major the interval only covers in part', () => {
    // `^24.15.0` does not admit 24.0.0, but a major-only CI pin resolves to
    // the newest matching release, so `24` is still a legal pin.
    expect(admitsMajor('^24.15.0', 24)).toBe(true)
    expect(admitsMajor('^24.15.0', 25)).toBe(false)
    // An interval that lives entirely inside one major still admits that major.
    expect(admitsMajor('^0.2.3', 0)).toBe(true)
    expect(admitsMajor('^0.2.3', 1)).toBe(false)
    // And an open-ended comparator admits every major from its floor upward.
    expect(admitsMajor('>=26.0.0', 99)).toBe(true)
  })

  it('rejects a CI pin moved to a major the range does not admit', () => {
    const drifted = WORKFLOW.replaceAll("node-version: '24'", "node-version: '22'")
    expect(drifted).not.toBe(WORKFLOW)
    const findings = checkNodeFloorAgreement({
      enginesNode: ENGINES_NODE,
      docs: {},
      workflow: drifted
    })
    const pins = (WORKFLOW.match(/node-version:/g) ?? []).length
    // One finding per pin: the workflow pins the same major in two jobs, and
    // checking only the first would let the second drift unnoticed.
    expect(findings).toHaveLength(pins)
    expect(findings.join('\n')).toMatch(/22/)
  })

  it('reports a workflow that pins no Node version at all', () => {
    const findings = checkNodeFloorAgreement({
      enginesNode: ENGINES_NODE,
      docs: {},
      workflow: 'name: Build\n'
    })
    expect(findings.join('\n')).toMatch(/node-version/)
  })
})

describe('declaration gate: the minimum-version parser handles a disjunction', () => {
  const cases: Array<[string, string]> = [
    ['^24.15.0 || >=26.0.0', '24.15.0'],
    ['>=26.0.0 || ^24.15.0', '24.15.0'],
    ['>=22.22.2 || ^24.15.0 || >=26.0.0', '22.22.2'],
    ['^24.15.0', '24.15.0'],
    ['~26.1.2', '26.1.2'],
    ['26.1.2', '26.1.2'],
    ['=26.1.2', '26.1.2'],
    ['^0.2.3 || ^1.0.0', '0.2.3'],
    ['^0.0.3', '0.0.3'],
    ['>=24.15.0', '24.15.0']
  ]

  it('has cases to run, so the loop below cannot pass vacuously', () => {
    expect(cases).toHaveLength(10)
  })

  it.each(cases)('reads the minimum of %s as %s', (range, expected) => {
    expect(minimumVersion(range)).toBe(expected)
  })

  it.each(['workspace:*', 'lts/*', 'node', ''])(
    'returns null for %s rather than inventing a version',
    (range) => {
      expect(minimumVersion(range)).toBeNull()
    }
  )
})

describe('declaration gate: a declared floor equals the installed version', () => {
  const declaredOf = (): Record<string, string> => ({
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  })

  const installedVersionOf = (name: string): string | undefined => {
    const manifest = join(ROOT, 'node_modules', name, 'package.json')
    if (!existsSync(manifest)) return undefined
    return (JSON.parse(readFileSync(manifest, 'utf-8')) as { version?: string }).version
  }

  it('finds every direct dependency installed before asserting anything about them', () => {
    // The anti-vacuity guard for the two tests below. If `installed` were
    // silently empty, "no findings" would mean "nothing was checked".
    const declared = declaredOf()
    expect(Object.keys(declared).length).toBeGreaterThan(0)
    const absent = Object.keys(declared).filter((name) => installedVersionOf(name) === undefined)
    expect(absent).toEqual([])
  })

  it('reports nothing for the tree as it stands', () => {
    const declared = declaredOf()
    const installed = Object.fromEntries(
      Object.keys(declared).map((name) => [name, installedVersionOf(name)])
    )
    expect(checkDeclaredFloors({ declared, installed })).toEqual([])
  })

  it('reads the floor of every declared range, so none is skipped', () => {
    const floors = Object.entries(declaredOf()).map(([name, range]) => [name, rangeFloor(range)])
    expect(floors.filter(([, floor]) => floor === null)).toEqual([])
  })

  it('accepts an exact pin equal to the installed version', () => {
    // pdfjs-dist is pinned exactly. A floor extractor that assumed a caret or
    // a tilde would either reject the pin or read a floor that is not there.
    expect(
      checkDeclaredFloors({
        declared: { 'pdfjs-dist': '6.4.299' },
        installed: { 'pdfjs-dist': '6.4.299' }
      })
    ).toEqual([])
    expect(rangeFloor(packageJson.dependencies['pdfjs-dist'])).toBe('6.4.299')
  })

  it('rejects a floor below the installed version, naming the package', () => {
    const findings = checkDeclaredFloors({
      declared: { react: '^18.0.0' },
      installed: { react: '19.1.0' }
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatch(/^react:/)
    expect(findings[0]).toMatch(/18\.0\.0/)
    expect(findings[0]).toMatch(/19\.1\.0/)
  })

  it('rejects a floor above the installed version too', () => {
    // The other direction matters: a floor above the tree makes `npm ci`
    // install something the manifest never described.
    const findings = checkDeclaredFloors({
      declared: { react: '^99.0.0' },
      installed: { react: '19.1.0' }
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatch(/99\.0\.0/)
  })

  it('rejects a direct dependency that is not installed, rather than skipping it', () => {
    // In CI `npm ci` runs first, so a missing direct dependency means the tree
    // is wrong. Skipping it would let the gate scan almost nothing and report
    // a clean bill of health for it.
    const findings = checkDeclaredFloors({ declared: { 'ghost-package': '^1.0.0' }, installed: {} })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatch(/ghost-package/)
    expect(findings[0]).toMatch(/not installed/)
  })

  it('rejects a range that declares no version rather than passing it silently', () => {
    const findings = checkDeclaredFloors({
      declared: { thing: 'workspace:*' },
      installed: { thing: '1.0.0' }
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatch(/workspace:\*/)
  })

  it('reports every problem instead of stopping at the first', () => {
    // `npm update` moves the whole tree at once, so a first-failure exit would
    // report one problem out of dozens and send the reader straight back here.
    const findings = checkDeclaredFloors({
      declared: { alpha: '^1.0.0', beta: '^1.0.0', ghost: '^1.0.0' },
      installed: { alpha: '1.0.0', beta: '2.0.0' }
    })
    expect(findings).toHaveLength(2)
    expect(findings.join('\n')).toMatch(/beta/)
    expect(findings.join('\n')).toMatch(/ghost/)
  })

  it.each([
    ['^1.2.3', '1.2.3'],
    ['~1.2.3', '1.2.3'],
    ['1.2.3', '1.2.3'],
    ['=1.2.3', '1.2.3'],
    ['^0.2.3', '0.2.3'],
    ['^6.4.299', '6.4.299']
  ])('reads the floor of %s as %s', (range, expected) => {
    expect(rangeFloor(range)).toBe(expected)
  })

  it.each(['workspace:*', 'lts/*', 'node', ''])(
    'returns no floor for %s rather than returning the range',
    (range) => {
      expect(rangeFloor(range)).toBeNull()
    }
  )
})

describe('declaration gate: the script fails the build when it should', () => {
  /**
   * Runs the gate against a purpose-built tree.
   *
   * The unit tests above exercise the rules; this exercises `main()`, the
   * report and the exit code, which is what CI actually observes. A gate that
   * has only ever been seen pass is unverified, and a fixture is the only way
   * to see it fail without corrupting the repository on disk.
   */
  const runGate = (files: Record<string, string>): { status: number; output: string } => {
    const dir = mkdtempSync(join(tmpdir(), 'declaration-gate-'))
    try {
      mkdirSync(join(dir, 'scripts'), { recursive: true })
      copyFileSync(join(ROOT, GATE), join(dir, 'scripts', 'check-declaration-consistency.mjs'))
      for (const [relative, contents] of Object.entries(files)) {
        const target = join(dir, relative)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, contents)
      }
      const result = spawnSync(
        process.execPath,
        [join(dir, 'scripts', 'check-declaration-consistency.mjs')],
        {
          encoding: 'utf-8'
        }
      )
      return { status: result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  const consistentTree = (): Record<string, string> => ({
    'package.json': JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      engines: { node: '^24.15.0 || >=26.0.0' },
      dependencies: { alpha: '^1.0.0' }
    }),
    'README.md': 'Requires Node.js 24.15+ or 26+.',
    'README_TR.md': 'Node.js 24.15+ veya 26+ gerekir.',
    'CONTRIBUTING.md': 'Node.js 24.15+ / 26+',
    '.github/workflows/build.yml': "jobs:\n  quality:\n    steps:\n      - node-version: '24'\n",
    'node_modules/alpha/package.json': JSON.stringify({ name: 'alpha', version: '1.0.0' })
  })

  it('exits 0 and says what it checked', () => {
    const { status, output } = runGate(consistentTree())
    expect(output).toMatch(/\[declarations\]/)
    expect(status).toBe(0)
  })

  it('exits 1 and names every problem when the tree drifts', () => {
    const tree = consistentTree()
    const drifted = {
      ...tree,
      'README_TR.md': 'Node.js 20+ gerekir.',
      'package.json': JSON.stringify({
        name: 'fixture',
        version: '1.0.0',
        engines: { node: '^24.15.0 || >=26.0.0' },
        dependencies: { alpha: '^1.0.0', beta: '^2.0.0' }
      }),
      'node_modules/beta/package.json': JSON.stringify({ name: 'beta', version: '3.1.0' })
    }
    const { status, output } = runGate(drifted)
    expect(status).toBe(1)
    expect(output).toMatch(/README_TR\.md/)
    expect(output).toMatch(/beta/)
  })
})

describe('declaration gate: it is wired, and it is blocking', () => {
  it('runs the script from a ci: prefixed npm script', () => {
    expectRunsTheGate(scripts[NPM_SCRIPT])
  })

  it('rejects an npm script that does not run the gate', () => {
    // Proves the rule above bites rather than being satisfied by any command
    // that merely names the file.
    for (const drifted of [
      'echo declarations',
      'node scripts/check-version-consistency.mjs',
      'node scripts/check-declaration-consistency.d.mts',
      ''
    ]) {
      expect(() => expectRunsTheGate(drifted), JSON.stringify(drifted)).toThrow()
    }
  })

  it('is a quality step running that command', () => {
    expect(blockFor(CI_STEP)).toContain(`npm run ${NPM_SCRIPT}`)
  })

  it('is blocking: the step carries no continue-on-error', () => {
    expectBlocking(blockFor(CI_STEP))
  })

  it('rejects a step that has been softened', () => {
    // Proves the rule above bites.
    expect(() =>
      expectBlocking('      - name: Declaration consistency\n        continue-on-error: true\n')
    ).toThrow()
  })

  it('sits next to the other pre-flight declaration gates', () => {
    // `Version consistency` and this step are the two gates that read the
    // repository's own declarations; running them far apart invites a reader
    // to treat the gap between them as meaningful.
    expect(WORKFLOW.indexOf(`- name: ${CI_STEP}`)).toBeGreaterThan(
      WORKFLOW.indexOf('- name: Version consistency')
    )
  })

  it('leaves the pre-flight gates it sits beside blocking', () => {
    for (const name of ['Repository hygiene guard', 'Version consistency']) {
      expectBlocking(blockFor(name))
    }
  })
})
