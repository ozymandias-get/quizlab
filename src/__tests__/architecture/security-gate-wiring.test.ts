/**
 * Regression tests for the security gates.
 *
 * The three gates (production audit, Semgrep, Electronegativity) have each
 * been inert in a way that looked configured:
 *
 *   - `npm audit --audit-level=high` is documented in CODING_STANDARD.md as a
 *     per-PR gate, but it has no allowlist, so the one real production
 *     advisory could never be carried. The documented command was replaced
 *     with a checker that supports time-boxed exceptions.
 *   - `semgrep` without `--error` prints findings and still exits 0, so a scan
 *     step can be green while reporting errors.
 *   - Electronegativity's exit code does not encode a severity threshold, and
 *     its report is unstable, so a bare CLI call is neither blocking nor
 *     reliably scored.
 *
 * These assert the gates are wired and blocking, not merely present.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import packageJson from '../../../package.json'
import { advisoryIdsOf, validateException } from '../../../scripts/check-audit.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const WORKFLOW = readFileSync(join(ROOT, '.github', 'workflows', 'build.yml'), 'utf-8')
const EXCEPTIONS = JSON.parse(
  readFileSync(join(ROOT, 'security', 'audit-exceptions.json'), 'utf-8')
) as {
  exceptions: Array<{
    package?: string
    installed?: string
    severity?: string
    advisories?: string[]
    reason?: string | string[]
    expires?: string
  }>
}

const scripts = packageJson.scripts as Record<string, string>
const SEMGREP_GATE = readFileSync(join(ROOT, 'scripts', 'check-semgrep.mjs'), 'utf-8')

/** Splits the workflow into `- name:` delimited step blocks. */
const stepBlocks = (): string[] =>
  WORKFLOW.split(/\n(?=\s*- name:)/).filter((block) => block.includes('- name:'))

const blockFor = (stepName: string): string => {
  const block = stepBlocks().find((candidate) => candidate.includes(`- name: ${stepName}`))
  expect(block, `workflow step not found: ${stepName}`).toBeDefined()
  return block as string
}

describe('security gate: quality job runs them', () => {
  it.each([
    ['Semgrep (production sources)', 'npm run analyze:semgrep'],
    ['Production Dependency Audit', 'npm run check:audit'],
    ['Electron Hardening (Electronegativity)', 'npm run check:electron-security']
  ])('%s is a quality step', (stepName, command) => {
    expect(blockFor(stepName)).toContain(command)
  })

  it.each([
    'Semgrep (production sources)',
    'Production Dependency Audit',
    'Electron Hardening (Electronegativity)'
  ])('%s is not allowed to fail silently', (stepName) => {
    // A continue-on-error step reports success no matter what it finds, which
    // is how these gates lose their meaning.
    expect(blockFor(stepName)).not.toContain('continue-on-error')
  })

  it('installs a pinned semgrep so the rule engine cannot drift', () => {
    const step = blockFor('Install Semgrep')
    expect(step).toMatch(/semgrep==\d+\.\d+\.\d+/)
  })
})

describe('security gate: semgrep actually fails on findings', () => {
  it('routes through a script so exclude globs survive every shell', () => {
    // npm runs scripts through cmd.exe on Windows, where a quoted glob reaches
    // semgrep with its quotes attached. The gate would fail on test findings
    // locally while passing on Linux CI.
    expect(scripts['analyze:semgrep']).toBe('node scripts/check-semgrep.mjs')
  })

  it('uses --error', () => {
    // Without --error semgrep reports findings and exits 0.
    expect(SEMGREP_GATE).toContain("'--error'")
  })

  it('gates on ERROR severity', () => {
    expect(SEMGREP_GATE).toContain("'--severity'")
    expect(SEMGREP_GATE).toContain("'ERROR'")
  })

  it('scans all three source roots', () => {
    for (const dir of ['src/', 'electron/', 'shared/']) {
      expect(SEMGREP_GATE).toContain(`'${dir}'`)
    }
  })

  it('excludes tests with a glob semgrep does not treat as match-all', () => {
    // With a leading globstar semgrep 1.144 scans zero files and exits 2,
    // which this gate would otherwise report as a clean scan.
    expect(SEMGREP_GATE).not.toMatch(/'\*\*\/__tests__/)
  })

  it('fails when the scan covers almost nothing', () => {
    // A gate that scanned zero files has proved nothing and must not pass.
    expect(SEMGREP_GATE).toContain('MIN_FILES')
    expect(SEMGREP_GATE).toMatch(/Number\(scanned\) < MIN_FILES/)
  })

  it('every test file lives in a __tests__ directory', () => {
    // The exclude pattern is a substring match on the directory name, so this
    // is what makes it safe rather than merely convenient.
    const roots = ['src', 'electron', 'shared']
    const offenders: string[] = []

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name) && !full.includes('__tests__')) {
          offenders.push(full)
        }
      }
    }

    for (const root of roots) walk(join(ROOT, root))
    expect(offenders).toEqual([])
  })
})

describe('security gate: audit uses a checker, not a bare npm audit', () => {
  it('routes the gate through the exception-aware script', () => {
    expect(scripts['check:audit']).toBe('node scripts/check-audit.mjs')
  })

  it('no longer keeps the raw failing command as the documented gate', () => {
    // `npm audit --audit-level=high` exits 1 on the accepted pdfjs advisory,
    // so it could never be green. Its removal is the point of the change.
    expect(scripts['audit:high']).toBeUndefined()
    expect(Object.values(scripts).join('\n')).not.toContain('npm audit --audit-level=high')
  })

  it('is part of the combined security script', () => {
    expect(scripts['analyze:security']).toContain('check:audit')
    expect(scripts['analyze:security']).toContain('check:electron-security')
  })
})

describe('security gate: audit exceptions stay reviewable', () => {
  it('is a list', () => {
    expect(Array.isArray(EXCEPTIONS.exceptions)).toBe(true)
  })

  it.each(EXCEPTIONS.exceptions.map((entry, index) => [index, entry] as const))(
    'entry %i documents why, what it accepts, and when it expires',
    (_index, entry) => {
      expect(entry.package).toBeTruthy()
      expect(entry.advisories?.length ?? 0).toBeGreaterThan(0)
      // The checker matches the installed version against the reviewed one.
      expect(entry.installed).toMatch(/^\d+\.\d+\.\d+/)
      // A time-boxed exception is only reviewable if the date is a real date.
      expect(entry.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      const reason = Array.isArray(entry.reason) ? entry.reason.join(' ') : (entry.reason ?? '')
      expect(reason.length).toBeGreaterThan(80)
    }
  )

  it('every recorded advisory id is one the checker can find in a real report', () => {
    // The checker extracts ids from advisory urls, so an id that is not in
    // GHSA/CVE form would silently never match.
    for (const entry of EXCEPTIONS.exceptions) {
      for (const id of entry.advisories ?? []) {
        expect(id).toMatch(/^(GHSA-[a-z0-9-]+|CVE-\d{4}-\d+)$/i)
      }
    }
  })
})

describe('security gate: audit exception drift detection', () => {
  const via = (url: string) => [{ source: 1, name: 'x', url }]

  it('extracts the GHSA id from an advisory url', () => {
    const ids = advisoryIdsOf(via('https://github.com/advisories/GHSA-wgrm-67xf-hhpq'))
    expect(ids).toContain('GHSA-WGRM-67XF-HHPQ')
  })

  it('tolerates an advisory with no recognisable id', () => {
    expect(advisoryIdsOf(via('https://example.invalid/whatever'))).toEqual([])
  })

  it('accepts an exception that matches both the advisory and the version', () => {
    const problems = validateException(
      { package: 'pdfjs-dist', installed: '3.11.174', advisories: ['GHSA-wgrm-67xf-hhpq'] },
      { name: 'pdfjs-dist', severity: 'high', advisoryIds: ['GHSA-WGRM-67XF-HHPQ'] },
      '3.11.174'
    )
    expect(problems).toEqual([])
  })

  it('rejects an exception whose advisory no longer matches', () => {
    // The review note would describe a risk that is no longer the reported one.
    const problems = validateException(
      { package: 'pdfjs-dist', installed: '3.11.174', advisories: ['GHSA-some-other-id'] },
      { name: 'pdfjs-dist', severity: 'high', advisoryIds: ['GHSA-WGRM-67XF-HHPQ'] },
      '3.11.174'
    )
    expect(problems.join('\n')).toMatch(/re-review/)
  })

  it('rejects an exception reviewed against a version that is no longer installed', () => {
    const problems = validateException(
      { package: 'pdfjs-dist', installed: '3.11.174', advisories: ['GHSA-wgrm-67xf-hhpq'] },
      { name: 'pdfjs-dist', severity: 'high', advisoryIds: ['GHSA-WGRM-67XF-HHPQ'] },
      '4.2.0'
    )
    expect(problems.join('\n')).toMatch(/4\.2\.0 is installed/)
  })

  it('rejects an exception that records no advisory at all', () => {
    const problems = validateException(
      { package: 'pdfjs-dist' },
      { name: 'pdfjs-dist', severity: 'high', advisoryIds: ['GHSA-WGRM-67XF-HHPQ'] },
      '3.11.174'
    )
    expect(problems.join('\n')).toMatch(/records no advisory id/)
  })
})
