/**
 * Declaration consistency gate.
 *
 * Two invariants in this repository were correct by coincidence, and nothing
 * said so.
 *
 * **The Node floor is stated six times.** `package.json` `engines.node`,
 * `README.md`, `README_TR.md`, `CONTRIBUTING.md`, and the two `node-version`
 * pins in `.github/workflows/build.yml`. Only the first of the six is a
 * declaration the others could be derived from; three are prose a contributor
 * might read and two are CI pins that decide what actually ran. No gate
 * compared them, so the next thing that moves the floor — and it moves when the
 * dependency that sets it is bumped, which today is jsdom 30 — would leave a
 * green build shipping six different answers, and a contributor reading the
 * Turkish README would be told to install a Node that CI does not use.
 *
 * **"Declared floor == installed version" was unasserted.** Every direct
 * dependency's range floor is pinned to the version actually installed, which
 * is what makes `npm ci` reproducible from the manifest alone. `npm update`
 * behaves nothing like `npm install` here: it rewrites only
 * `package-lock.json`, moving the tree forward inside the ranges already
 * declared. `package.json` is untouched, the two drift apart, and nothing
 * reports it. `npm outdated` shows the symptom days later, by which point the
 * manifest no longer explains the tree.
 *
 * The gate also refuses to pass quietly. A direct dependency that is not
 * installed is a finding, not a skip: CI runs `npm ci` before this step, so a
 * missing one means the tree is wrong, and a gate that skipped it would scan
 * almost nothing and report a clean bill of health.
 *
 * Every problem is reported before exiting, unlike `check-version-consistency.mjs`
 * beside it, which stops at the first. That gate's inputs are one version
 * string and two badges, so one problem is the normal case. Here a floor bump
 * desynchronises all six statements at once, and an `npm update` re-opens the
 * gap for every package it moved — a first-failure exit would print one of a
 * dozen and send the reader straight back to this command for the rest. The
 * cost of aggregating is that the first line of output is not always the most
 * important one, which is why every line names the file and the two values.
 *
 * Usage: node scripts/check-declaration-consistency.mjs
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

/** The documents that state the floor in prose, so a reader can find it. */
const DOC_FILES = ['README.md', 'README_TR.md', 'CONTRIBUTING.md']
const WORKFLOW_FILE = join('.github', 'workflows', 'build.yml')

/** A `major.minor.patch` triple. `null` in the upper bound means unbounded. */
const INFINITY = null

/**
 * Reads a version out of a range fragment, ignoring whatever operator precedes
 * it. Deliberately unpinned on the left: `>=26.0.0` and `^24.15.0` are the only
 * things this has to survive, and a range it cannot read is reported rather
 * than guessed at.
 */
const parseVersion = (text) => {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(text))
  if (!match) return null
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}

/** Orders two version triples, treating `INFINITY` as greater than anything. */
const compare = (left, right) => {
  if (left === INFINITY) return right === INFINITY ? 0 : 1
  if (right === INFINITY) return -1
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1
  }
  return 0
}

/** True when `[aLo, aHi)` and `[bLo, bHi)` share at least one version. */
const overlaps = (aLo, aHi, bLo, bHi) => compare(aLo, bHi) < 0 && compare(bLo, aHi) < 0

/** The version a caret range stops admitting, per the caret's three shapes. */
const caretCeiling = ([major, minor, patch]) => {
  if (major > 0) return [major + 1, 0, 0]
  if (minor > 0) return [0, minor + 1, 0]
  return [0, 0, patch + 1]
}

/**
 * Expands one comparator into the versions it admits.
 *
 * Only the lower bounds this repository plausibly declares are understood: `^`,
 * `~`, `>=`, `=`, and a bare version. `>` admits no least version at all, and
 * `<`/`<=` describe the top of a range this gate does not model, so any of
 * them makes the whole range unreadable. Half-understanding a range would be
 * worse than refusing it: the failure would be a floor that looks right.
 */
const comparatorInterval = (comparator) => {
  const [, operator = '', version] = /^(\^|~|>=|<=|>|<|=)?\s*(.*)$/.exec(comparator.trim()) ?? []
  const parsed = parseVersion(version)
  if (parsed === null) return null
  if (operator === '^') return { lo: parsed, hi: caretCeiling(parsed) }
  if (operator === '~') return { lo: parsed, hi: [parsed[0], parsed[1] + 1, 0] }
  if (operator === '>=') return { lo: parsed, hi: INFINITY }
  if (operator === '>' || operator === '<' || operator === '<=') return null
  // `=26.1.2` and a bare `26.1.2` both admit exactly one version, and the
  // interval is half-open, so the ceiling is the next patch. Over integer
  // triples `[26.1.2, 26.1.3)` holds 26.1.2 and nothing else, which is what an
  // exact pin means and is why `pdfjs-dist` has to survive this.
  return { lo: parsed, hi: [parsed[0], parsed[1], parsed[2] + 1] }
}

/**
 * Splits a range into one half-open interval per disjunct, or `null` when the
 * range says something this gate cannot read honestly.
 */
const rangeIntervals = (range) => {
  if (typeof range !== 'string' || range.trim() === '') return null
  const intervals = []
  for (const branch of range.split('||')) {
    const comparators = branch.trim().split(/\s+/).filter(Boolean)
    if (comparators.length === 0) return null
    let lo
    let hi
    for (const comparator of comparators) {
      const interval = comparatorInterval(comparator)
      if (interval === null) return null
      if (lo === undefined || compare(interval.lo, lo) < 0) lo = interval.lo
      if (hi === undefined || compare(interval.hi, hi) < 0) hi = interval.hi
    }
    if (compare(lo, hi) >= 0) return null
    intervals.push({ lo, hi })
  }
  return intervals
}

/**
 * The lowest version a declared range admits — `24.15.0` for the range
 * `^24.15.0 || >=26.0.0`.
 *
 * This is the single source the documents and the CI pin are checked against,
 * so nothing in the repository has to restate it.
 */
export const minimumVersion = (range) => {
  const intervals = rangeIntervals(range)
  if (intervals === null) return null
  let lowest
  for (const { lo } of intervals) {
    if (lowest === undefined || compare(lo, lowest) < 0) lowest = lo
  }
  return [String(lowest[0]), String(lowest[1]), String(lowest[2])].join('.')
}

/**
 * Whether a given major is admitted by the range at all.
 *
 * This is the honest question for a CI pin. `node-version: '24'` is a
 * major-only selector that setup-node resolves to the newest matching
 * release, so it satisfies a `24.15.0` floor without the gate being able to see
 * which patch CI actually used — checking for the patch would be checking a
 * value that does not exist in the file. What must hold is that *some* release
 * in that major is admitted.
 */
export const admitsMajor = (range, major) => {
  const intervals = rangeIntervals(range)
  if (intervals === null) return false
  return intervals.some(({ lo, hi }) => overlaps([major, 0, 0], [major + 1, 0, 0], lo, hi))
}

/**
 * The version a declared range refuses to resolve below — everything after the
 * operator.
 *
 * A full `major.minor.patch` is required rather than normalised: a partial
 * floor like `^24.15` cannot be compared to an installed version without
 * deciding what the author meant, and this gate would rather say so.
 */
export const rangeFloor = (range) => /\d+\.\d+\.\d+/.exec(String(range))?.[0] ?? null

/**
 * Reports where the declared Node floor and the statements of it disagree.
 *
 * Takes data rather than reading files, so the rules can be unit tested
 * without a repository on disk. `docs` maps a filename to its text, with `null`
 * for a file that is absent; `workflow` is the build.yml text, and omitting it
 * skips the CI pin check so a caller can exercise the document rules alone.
 */
export const checkNodeFloorAgreement = ({ enginesNode, docs, workflow }) => {
  const problems = []

  if (typeof enginesNode !== 'string' || enginesNode.trim() === '') {
    problems.push(
      'package.json has no engines.node: the Node floor has to be declared once, ' +
        'and every other statement of it derived from there'
    )
    return problems
  }

  const floor = minimumVersion(enginesNode)
  if (floor === null) {
    problems.push(
      `package.json engines.node is ${JSON.stringify(enginesNode)}, which states no ` +
        'minimum version this gate can check the documents against'
    )
    return problems
  }

  // Matched on major.minor rather than the full version: the Turkish README
  // renders the disjunction differently from the English one, and both are
  // correct as long as they name the same floor.
  const label = floor.replace(/\.\d+$/, '')
  for (const [name, text] of Object.entries(docs ?? {})) {
    if (text === null || text === undefined) {
      problems.push(`${name} is missing: the Node floor ${label} has to be stated where it is read`)
      continue
    }
    if (!text.includes(label)) {
      problems.push(
        `${name} does not state the Node floor ${label} that package.json engines.node ` +
          `${JSON.stringify(enginesNode)} declares`
      )
    }
  }

  if (workflow !== undefined) {
    const pins = [...String(workflow).matchAll(/node-version:\s*['"]?v?(\d+)/g)].map((match) =>
      Number(match[1])
    )
    if (pins.length === 0) {
      // Either the workflow pins no Node at all, or it pins one this gate
      // cannot read — `lts/*`, say. Both are a finding: a pin the gate cannot
      // evaluate is a pin that asserts nothing about the declared range.
      problems.push(
        '.github/workflows/build.yml pins no node-version this gate can read, so nothing ' +
          'asserts that CI runs a Node the declared range admits'
      )
    }
    for (const major of pins) {
      if (!admitsMajor(enginesNode, major)) {
        problems.push(
          `.github/workflows/build.yml pins node-version ${major}, which package.json ` +
            `engines.node ${JSON.stringify(enginesNode)} does not admit`
        )
      }
    }
  }

  return problems
}

/**
 * Reports every direct dependency whose declared floor is not the version
 * actually installed, plus every direct dependency that is not installed at
 * all.
 *
 * Not installed is a finding, not a skip: this runs after `npm ci`, so a
 * missing direct dependency means the tree is wrong. Skipping it would let a
 * gate that checked three of eighty-five packages report a clean tree.
 */
export const checkDeclaredFloors = ({ declared, installed }) => {
  const problems = []
  for (const [name, range] of Object.entries(declared ?? {})) {
    const version = installed?.[name]
    if (version === undefined || version === null) {
      problems.push(`${name}: declared ${range} but is not installed — run npm install`)
      continue
    }
    const floor = rangeFloor(range)
    if (floor === null) {
      problems.push(
        `${name}: declared ${range} carries no full major.minor.patch floor to compare ` +
          `against the ${version} that is installed`
      )
      continue
    }
    if (floor !== version) {
      problems.push(`${name}: declared floor ${floor} but ${version} is installed`)
    }
  }
  return problems
}

/**
 * The installed version of each declared dependency.
 *
 * npm places every direct dependency at the top of `node_modules`, so this path
 * is either where the package is or where it genuinely is not — there is no
 * nested copy for a direct dependency to hide in.
 */
const installedVersions = (declared) => {
  const installed = {}
  for (const name of Object.keys(declared)) {
    const manifest = join(ROOT, 'node_modules', name, 'package.json')
    installed[name] = existsSync(manifest)
      ? JSON.parse(readFileSync(manifest, 'utf-8')).version
      : undefined
  }
  return installed
}

const main = () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
  const declared = { ...pkg.dependencies, ...pkg.devDependencies }

  const docs = {}
  for (const name of DOC_FILES) {
    const file = join(ROOT, name)
    docs[name] = existsSync(file) ? readFileSync(file, 'utf-8') : null
  }

  const workflowPath = join(ROOT, WORKFLOW_FILE)
  const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf-8') : ''

  const problems = [
    ...checkNodeFloorAgreement({ enginesNode: pkg.engines?.node, docs, workflow }),
    ...checkDeclaredFloors({ declared, installed: installedVersions(declared) })
  ]

  if (problems.length > 0) {
    console.error('\n[declarations] FAILED\n')
    for (const problem of problems) console.error(`  ${problem}`)
    console.error(
      '\nThe Node floor is declared once, in package.json engines.node. Each direct\n' +
        'dependency range floor is pinned to the version actually installed, which is\n' +
        'what makes npm ci reproducible from the manifest alone. npm update rewrites\n' +
        'only package-lock.json, so raise the floors to match or reinstall to move back.\n'
    )
    process.exit(1)
  }

  const pins = (workflow.match(/node-version:/g) ?? []).length
  console.log(
    `[declarations] Node floor ${minimumVersion(pkg.engines.node)} agrees across package.json, ` +
      `${DOC_FILES.length} documents and ${pins} CI pin(s); ${Object.keys(declared).length} ` +
      'declared floors match the installed tree'
  )
}

// Only run when invoked directly. Without this guard the unit tests that import
// the validation helpers would read this repository's own files and an import
// would have the side effect of running a real gate.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
