/**
 * Production dependency audit gate.
 *
 * Fails on any high or critical advisory that reaches the shipped application.
 *
 * Why not `npm audit --audit-level=high` directly: it has no allowlist, so a
 * documented, time-boxed exception is impossible. Teams that want one usually
 * end up dropping the gate or adding `continue-on-error`, which is the failure
 * mode this script exists to avoid.
 *
 * "Reaches the shipped application" is resolved from `npm ls --omit=dev`
 * rather than `npm audit --omit=dev`. The two disagree: audit reported
 * brace-expansion as a production high while ls showed it reachable only
 * through eslint, stryker and electron-builder. Trusting audit's own filter
 * would have meant an exception for a package that never ships.
 *
 * The checker also fails in the other direction, so the list cannot rot:
 *   - a listed advisory that is no longer reported is stale and must be removed
 *   - an entry past its `expires` date must be re-reviewed
 *
 * Usage: node scripts/check-audit.mjs
 */

import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const EXCEPTIONS_FILE = join(ROOT, 'security', 'audit-exceptions.json')
const BLOCKING_SEVERITIES = new Set(['high', 'critical'])
const TODAY = new Date().toISOString().slice(0, 10)

/**
 * Invokes npm without a shell.
 *
 * `npm` is a shell script on POSIX and npm.cmd on Windows, and Node 22+ refuses
 * to spawn a .cmd without `shell: true` (the CVE-2024-27980 fix), which in turn
 * raises DEP0190 because the arguments are not escaped. When this runs through
 * `npm run`, npm_execpath points straight at the CLI entry, so we can exec it
 * with the current Node binary and skip the shell entirely.
 */
const npmCommand = () => {
  const cli = process.env.npm_execpath
  if (cli && existsSync(cli)) return { bin: process.execPath, prefix: [cli] }
  return {
    bin: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    prefix: [],
    shell: process.platform === 'win32'
  }
}

const fail = (lines) => {
  console.error('\n[audit] FAILED\n')
  for (const line of lines) console.error(`  ${line}`)
  console.error('')
  process.exit(1)
}

const loadExceptions = () => {
  if (!existsSync(EXCEPTIONS_FILE)) {
    fail([`missing ${EXCEPTIONS_FILE}`])
  }
  const parsed = JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf-8'))
  if (!Array.isArray(parsed.exceptions)) {
    fail(['audit-exceptions.json must contain an "exceptions" array'])
  }
  return parsed.exceptions
}

/**
 * The packages that actually reach the shipped application, mapped to version.
 *
 * `npm ls --json` omits `name` on child nodes; the package name is the key in
 * the parent's dependency map, so the walk has to carry it. Versions are kept
 * so an exception can be pinned to the build it was reviewed against.
 */
const shippedPackages = () => {
  const report = runNpm(['ls', '--omit=dev', '--all', '--json'])
  const versions = new Map()
  const walk = (dependencies) => {
    for (const [name, node] of Object.entries(dependencies ?? {})) {
      if (!node || typeof node !== 'object') continue
      // A package can appear at several versions; the lowest is the one a
      // floor-based exception has to be satisfied by.
      const existing = versions.get(name)
      if (existing === undefined || (node.version && node.version < existing)) {
        versions.set(name, node.version)
      }
      walk(node.dependencies)
    }
  }
  if (report?.name) versions.set(report.name, report.version)
  walk(report?.dependencies)
  return versions
}

/** Runs npm, tolerating the non-zero exit that audit/ls use to signal findings. */
const runNpm = (args) => {
  const { bin, prefix, shell } = npmCommand()
  try {
    return JSON.parse(
      execFileSync(bin, [...prefix, ...args], {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
        ...(shell ? { shell: true } : {})
      })
    )
  } catch (error) {
    // npm audit exits non-zero when it finds anything, so a throw is expected
    // when there is a report on stdout.
    if (error.stdout) return JSON.parse(error.stdout)
    fail([`npm ${args[0]} failed to run: ${error.message}`])
  }
}

/** Flattens the audit report into one row per package. */
const blockingFindings = (report) =>
  Object.entries(report.vulnerabilities ?? {})
    .map(([name, entry]) => ({
      name,
      severity: entry.severity,
      advisoryIds: advisoryIdsOf(entry.via)
    }))
    .filter((entry) => BLOCKING_SEVERITIES.has(entry.severity))

/**
 * Extracts GHSA and CVE ids from an advisory's url.
 *
 * This is what lets a documented exception stay honest. Without it, an entry
 * could name one advisory while a different one is actually being reported,
 * and the review note describing the real risk would be silently wrong.
 */
export const advisoryIdsOf = (via) => {
  const ids = new Set()
  for (const item of via) {
    const url = typeof item === 'string' ? item : (item?.url ?? '')
    const ghsa = url.match(/GHSA-[a-z0-9-]+/i)
    const cve = url.match(/CVE-\d{4}-\d+/i)
    if (ghsa) ids.add(ghsa[0].toUpperCase())
    if (cve) ids.add(cve[0].toUpperCase())
  }
  return [...ids]
}

/**
 * Checks that an exception still describes the finding it accepts.
 *
 * Returns the problems found, so the caller can report all of them at once.
 */
export const validateException = (exception, finding, shippedVersion) => {
  const problems = []

  const recorded = (exception.advisories ?? []).map((id) => id.toUpperCase())
  if (recorded.length === 0) {
    problems.push(`${finding.name}: exception records no advisory id`)
  } else if (finding.advisoryIds.length > 0) {
    const overlaps = recorded.some((id) => finding.advisoryIds.includes(id))
    if (!overlaps) {
      problems.push(
        `${finding.name}: exception lists ${recorded.join(', ')} but audit reports ` +
          `${finding.advisoryIds.join(', ') || 'no advisory id'} — re-review it`
      )
    }
  }

  const installed = shippedVersion ?? '(unknown)'
  if (exception.installed && exception.installed !== installed) {
    problems.push(
      `${finding.name}: exception was reviewed against ${exception.installed} but ` +
        `${installed} is installed — re-review it`
    )
  }

  return problems
}

const main = () => {
  const exceptions = loadExceptions()
  const shipped = shippedPackages()
  const allFindings = blockingFindings(runNpm(['audit', '--json']))

  const shippedFindings = allFindings.filter((entry) => shipped.has(entry.name))
  const notShipped = allFindings.filter((entry) => !shipped.has(entry.name))

  const matched = new Set()
  const unaccepted = []
  const drifted = []

  for (const finding of shippedFindings) {
    const exception = exceptions.find((candidate) => candidate.package === finding.name)
    if (!exception) {
      unaccepted.push(`${finding.name} (${finding.severity}) — no accepted exception`)
      continue
    }
    matched.add(finding.name)
    if (exception.expires && exception.expires < TODAY) {
      fail([
        `accepted exception for ${finding.name} expired on ${exception.expires}`,
        're-review it in security/audit-exceptions.json and update the date or remove the entry'
      ])
    }
    drifted.push(...validateException(exception, finding, shipped.get(finding.name)))
  }

  if (unaccepted.length > 0) {
    fail([
      `${unaccepted.length} unaccepted high/critical shipped ${unaccepted.length === 1 ? 'package' : 'packages'}:`,
      ...unaccepted.map((line) => `- ${line}`),
      '',
      'Fix it, or record a time-boxed exception in security/audit-exceptions.json'
    ])
  }

  if (drifted.length > 0) {
    fail([
      'accepted exception(s) no longer match the reported advisory:',
      ...drifted.map((line) => `- ${line}`)
    ])
  }

  const stale = exceptions
    .filter((exception) => !matched.has(exception.package))
    .map((exception) => `${exception.package} is no longer reported — remove the exception`)

  if (stale.length > 0) fail(stale)

  console.log(
    `[audit] shipped tree: ${shippedFindings.length === 0 ? 'clean' : `${shippedFindings.length} accepted`} ` +
      `(${shipped.size} packages reachable, ${exceptions.length} documented exception(s))`
  )
  if (notShipped.length > 0) {
    console.log(
      `[audit] not shipped: ${notShipped.length} high/critical in build/lint tooling only ` +
        `(${notShipped.map((entry) => entry.name).join(', ')})`
    )
  }
}

// Only run when invoked directly. Without this guard the unit tests that
// import the validation helpers would shell out to npm audit and npm ls, and
// an import would have the side effect of running a real gate.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
