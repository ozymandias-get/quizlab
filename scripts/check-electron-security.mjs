/**
 * Electron hardening gate.
 *
 * Runs Electronegativity against the app and fails on HIGH or CRITICAL
 * findings. Electronegativity's own exit code does not encode a severity
 * threshold, so the CSV it writes is parsed here instead.
 *
 * The report needs careful reading, which is the whole reason this is a script
 * rather than a bare CLI call:
 *
 *  - CSP_GLOBAL_CHECK is emitted nondeterministically. On some runs it is a
 *    complete LOW row; on others it is a malformed partial row carrying only
 *    a description and a URL. The finding is real either way, so the baseline
 *    is "1 LOW + 12 MEDIUM" and the LOW is conditional on the run.
 *  - A grade line ("A,") may or may not precede the header, so the header is
 *    located by content rather than by line number.
 *  - Descriptions contain words like "allow" and "flows", so a substring
 *    search for LOW matches "allow". Severities are only read from the
 *    severity column.
 *
 * Rows without a recognised severity are counted and reported as artifacts
 * rather than being folded into a severity bucket, and the build is never
 * failed by them. That keeps the gate from flaking on a tool that reports the
 * same finding two different ways.
 *
 * Reviewed baseline: 0 HIGH/CRITICAL, plus 12 MEDIUM and 1 LOW. The MEDIUMs
 * are intentional behaviour, not gaps:
 *   OPEN_EXTERNAL_JS_CHECK        shell.openExternal for auth and file URLs
 *   PRELOAD_JS_CHECK / AUXCLICK   the display-media picker window
 *   CERTIFICATE_ERROR_EVENT_...   flagged for handling certificate errors at
 *                                 all; the app rejects every one of them
 *   CUSTOM_ARGUMENTS_JS_CHECK     additionalArguments for per-window IPC
 *   CSP_GLOBAL_CHECK              the LOW above; the policy is stricter than
 *                                 the tool's parser understands
 *
 * Gating on HIGH/CRITICAL keeps the signal useful. Failing on MEDIUM would
 * mean baselining 12 accepted findings, which is the shape of gate that gets
 * ignored.
 *
 * Usage: node scripts/check-electron-security.mjs
 */

import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const REPORT_DIR = join(ROOT, 'reports', 'electron-security')
const REPORT_FILE = join(REPORT_DIR, 'analysis.csv')

const KNOWN_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'INFO'])
const BLOCKING_SEVERITIES = new Set(['HIGH', 'CRITICAL'])

const fail = (lines) => {
  console.error('\n[electron-security] FAILED\n')
  for (const line of lines) console.error(`  ${line}`)
  console.error('')
  process.exit(1)
}

const electronMajorMinor = () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
  return pkg.devDependencies.electron.replace(/^[^0-9]*/, '')
}

/**
 * Resolves the CLI entry point and runs it with the current Node binary.
 *
 * Invoking node_modules/.bin/electronegativity directly does not work here: on
 * Windows that is a .cmd shim, and Node 22+ refuses to spawn one without a
 * shell (the CVE-2024-27980 fix). Resolving the package's own bin entry and
 * exec'ing it with process.execPath avoids both the shim and a shell, and it
 * does not depend on how this script was invoked.
 */
const electronegativityEntry = () => {
  const manifest = join(ROOT, 'node_modules', '@doyensec', 'electronegativity', 'package.json')
  if (!existsSync(manifest)) {
    fail([`@doyensec/electronegativity not installed at ${manifest}`, 'run npm ci first'])
  }
  const pkg = JSON.parse(readFileSync(manifest, 'utf-8'))
  const relative = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.electronegativity
  const entry = join(ROOT, 'node_modules', '@doyensec', 'electronegativity', relative)
  if (!existsSync(entry)) {
    fail([`electronegativity entry not found at ${entry}`, 'run npm ci first'])
  }
  return entry
}

const runElectronegativity = () => {
  mkdirSync(REPORT_DIR, { recursive: true })

  const result = spawnSync(
    process.execPath,
    [
      electronegativityEntry(),
      '-i',
      'electron',
      '-r',
      '-e',
      electronMajorMinor(),
      '-o',
      REPORT_FILE
    ],
    { cwd: ROOT, stdio: 'inherit' }
  )

  if (result.error) {
    fail([`could not run electronegativity: ${result.error.message}`])
  }
  if (result.status !== 0) {
    fail([`electronegativity exited with ${result.status} — see the output above`])
  }
  if (!existsSync(REPORT_FILE)) {
    fail(['electronegativity produced no report'])
  }
}

/**
 * RFC4180-ish CSV reader.
 *
 * The header is located by content rather than by line number, because the
 * grade line may or may not precede it.
 *
 * Throws when no header is recognisable: an unreadable report must fail the
 * gate, never pass it.
 */
export const parseCsv = (text) => {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  const pushField = () => {
    row.push(field.trim())
    field = ''
  }
  const pushRow = () => {
    pushField()
    if (row.some((cell) => cell !== '')) rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') pushField()
    else if (char === '\n') pushRow()
    else if (char !== '\r') field += char
  }
  if (field !== '' || row.length > 0) pushRow()

  const headerIndex = rows.findIndex((cells) => cells[0] === 'issue' && cells.includes('severity'))
  if (headerIndex === -1) {
    throw new Error('the electronegativity report has no recognisable header row (issue/severity)')
  }

  const headers = rows[headerIndex]
  return rows
    .slice(headerIndex + 1)
    .map((cells) => Object.fromEntries(headers.map((key, index) => [key, cells[index] ?? ''])))
}

/**
 * Splits rows into real findings and unreadable tool artifacts.
 *
 * A row only counts as a finding when it carries a severity the tool actually
 * emits. Anything else is reported as an artifact so the baseline stays
 * honest, instead of being folded into a severity bucket by accident.
 */
export const classify = (rows) => {
  const findings = rows.filter((row) => KNOWN_SEVERITIES.has(row.severity))
  return {
    findings,
    artifacts: rows.filter((row) => !KNOWN_SEVERITIES.has(row.severity)),
    blocking: findings.filter((row) => BLOCKING_SEVERITIES.has(row.severity)),
    counts: findings.reduce((acc, row) => {
      acc[row.severity] = (acc[row.severity] ?? 0) + 1
      return acc
    }, {})
  }
}

export const formatCounts = (counts) =>
  Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([severity, count]) => `${count} ${severity}`)
    .join(', ')

const main = () => {
  // A stale report would let a crashed run look clean.
  rmSync(REPORT_FILE, { force: true })
  runElectronegativity()

  let rows
  try {
    rows = parseCsv(readFileSync(REPORT_FILE, 'utf-8'))
  } catch (error) {
    fail([error.message])
  }

  const { findings, artifacts, blocking, counts } = classify(rows)

  if (blocking.length > 0) {
    fail([
      `${blocking.length} HIGH/CRITICAL finding(s):`,
      ...blocking.map((row) => `- ${row.issue} ${row.filename}:${row.location} (${row.severity})`)
    ])
  }

  console.log(
    `[electron-security] no HIGH/CRITICAL findings (electron ${electronMajorMinor()})` +
      (findings.length > 0 ? ` — reviewed baseline: ${formatCounts(counts)}` : ' — no findings')
  )
  if (artifacts.length > 0) {
    console.log(
      `[electron-security] ignored ${artifacts.length} unparsable report row/rows ` +
        '(electronegativity grade and CSP check emit malformed rows)'
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
