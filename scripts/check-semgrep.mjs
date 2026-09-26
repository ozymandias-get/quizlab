/**
 * Semgrep gate.
 *
 * Scans production sources and fails on ERROR severity.
 *
 * This exists as a script rather than a bare CLI call in package.json for two
 * concrete reasons.
 *
 * Shell quoting: npm runs scripts through cmd.exe on Windows, where single
 * quotes are not syntax, so a quoted exclude pattern reaches semgrep with the
 * quotes attached, matches nothing, and the gate starts failing on test-only
 * findings — while the identical script passes on Linux CI. A gate whose
 * verdict depends on the runner is worse than no gate, so the arguments are
 * passed as an array and never go through a shell.
 *
 * An unreadable report must not read as clean. The obvious spelling of the
 * test exclusion — a leading globstar, the directory name, another globstar —
 * makes semgrep 1.144 exit 2 having scanned **zero** files. The gate would
 * have passed, having checked nothing. The scanned-file count is therefore
 * parsed from the report and treated as a hard failure when it drops to zero
 * or implausibly low.
 *
 * The exclusion pattern looks unusual next to the globstar spellings, and it
 * is deliberately the one that works. Every test file in this repository lives
 * under a __tests__ directory, and a test asserts that, so the pattern cannot
 * silently start missing tests. *
 * `--error` is what makes this blocking; without it semgrep prints findings
 * and still exits 0.
 *
 * Usage: node scripts/check-semgrep.mjs
 */

import { spawnSync } from 'child_process'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

const SOURCES = ['src/', 'electron/', 'shared/']

/**
 * Excludes test directories. A leading globstar must not be used here: with
 * one, semgrep matches everything, the scan reports zero files, and the run
 * exits 2 without producing findings to act on.
 */
const EXCLUDES = ['*__tests__*']

const ARGS = [
  'scan',
  '--config',
  '.semgrep.yml',
  '--error',
  '--severity',
  'ERROR',
  '--metrics=off',
  ...EXCLUDES.flatMap((pattern) => ['--exclude', pattern]),
  ...SOURCES
]

const SEMGREP = process.platform === 'win32' ? 'semgrep.exe' : 'semgrep'

/** A scan that covers almost nothing is a broken gate, not a clean one. */
const MIN_FILES = 100

const main = () => {
  const result = spawnSync(SEMGREP, ARGS, {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  })

  if (result.error) {
    console.error(
      `\n[semgrep] could not run semgrep: ${result.error.message}\n` +
        '  install it with: python -m pip install semgrep==1.144.0\n'
    )
    process.exit(1)
  }

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  // Semgrep writes its progress and summary to stderr, not stdout.
  const scanned = `${result.stdout}${result.stderr}`.match(/Ran \d+ rules? on (\d+) files?/)?.[1]

  if (result.status === 0) {
    if (!scanned) {
      console.error('[semgrep] FAILED: could not determine how many files were scanned')
      process.exit(1)
    }
    if (Number(scanned) < MIN_FILES) {
      console.error(
        `[semgrep] FAILED: only ${scanned} file(s) scanned, expected at least ${MIN_FILES}.\n` +
          '  An exclude pattern is probably matching everything, so this scan proves nothing.'
      )
      process.exit(1)
    }
    console.log(`[semgrep] no ERROR findings in production sources (${scanned} files scanned)`)
  }

  // Semgrep exits 1 on blocking findings, which is the behaviour we want.
  process.exit(result.status ?? 1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
