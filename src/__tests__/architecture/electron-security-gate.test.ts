import { describe, expect, it } from 'vitest'

import { classify, formatCounts, parseCsv } from '../../../scripts/check-electron-security.mjs'

const HEADER = 'issue, severity, confidence, filename, location, sample, description, url'

const row = (issue: string, severity: string, filename = 'app/file.ts', location = '1:1'): string =>
  `${issue},"${severity}","TENTATIVE","${filename}","${location}","sample()","description, with a comma","https://example.invalid"`

/**
 * Both shapes electronegativity actually produced across runs are covered.
 * Whichever one appears, the gate must reach the same conclusion about
 * HIGH/CRITICAL, or CI would pass and fail on the same code.
 */
const withCspAsFullRow = (body: string) => `${HEADER}\n${row('CSP_GLOBAL_CHECK', 'LOW')}\n${body}`
const withCspAsArtifact = (body: string) =>
  [
    HEADER,
    'A,"Failed to parse CSP, it may not be valid.",https://example.invalid/CSP_GLOBAL_CHECK',
    body
  ].join('\n')

const MEDIUM_BODY = ['C', 'D', 'E'].map((id) => row(`${id}_CHECK`, 'MEDIUM')).join('\n')

describe('electron security gate report parsing', () => {
  describe('header detection', () => {
    it('finds the header after a grade line', () => {
      const rows = parseCsv(`A,\n${HEADER}\n${row('X_CHECK', 'MEDIUM')}`)
      expect(rows).toHaveLength(1)
      expect(rows[0].issue).toBe('X_CHECK')
      expect(rows[0].severity).toBe('MEDIUM')
    })

    it('finds the header when it is the first line', () => {
      const rows = parseCsv(`${HEADER}\n${row('X_CHECK', 'MEDIUM')}`)
      expect(rows[0].issue).toBe('X_CHECK')
    })

    it('fails rather than scoring a report with no header', () => {
      expect(() => parseCsv('nonsense\nmore nonsense')).toThrow(/no recognisable header/)
    })
  })

  describe('csv handling', () => {
    it('keeps commas inside quoted descriptions out of the severity column', () => {
      const rows = parseCsv(`${HEADER}\n${row('X_CHECK', 'MEDIUM')}`)
      expect(rows[0].severity).toBe('MEDIUM')
      expect(rows[0].description).toBe('description, with a comma')
    })

    it('reads a real finding rather than a word that contains a severity', () => {
      // The tool's own descriptions contain "allow" and "flows", which a
      // substring search for LOW matches.
      const csv = `${HEADER}\n"X_CHECK","MEDIUM","FIRM","app/a.ts","1:1","s()","Do not allow insecure connections","u"\n"Y_CHECK","MEDIUM","FIRM","app/b.ts","1:1","s()","Limit navigation flows to untrusted origins","u"`
      const { counts } = classify(parseCsv(csv))
      expect(counts).toEqual({ MEDIUM: 2 })
    })
  })

  describe('classification', () => {
    /**
     * Electronegativity emits CSP_GLOBAL_CHECK as a full LOW row on some runs
     * and as a malformed partial row on others. Both shapes must reach the
     * same verdict, otherwise CI fails and passes on identical code.
     */
    it.each([
      ['CSP as a full row', withCspAsFullRow(MEDIUM_BODY), 1],
      ['CSP as a malformed row', withCspAsArtifact(MEDIUM_BODY), 0]
    ])('reaches the same verdict with %s', (_label, csv, lowCount) => {
      const { findings, blocking, counts } = classify(parseCsv(csv))
      expect(blocking).toHaveLength(0)
      expect(counts.LOW ?? 0).toBe(lowCount)
      expect(counts.MEDIUM).toBe(3)
      expect(findings).toHaveLength(3 + lowCount)
    })

    it('blocks on HIGH', () => {
      const { blocking } = classify(parseCsv(`${HEADER}\n${row('A_CHECK', 'HIGH')}`))
      expect(blocking.map((entry) => entry.issue)).toEqual(['A_CHECK'])
    })

    it('blocks on CRITICAL', () => {
      const { blocking } = classify(parseCsv(`${HEADER}\n${row('B_CHECK', 'CRITICAL')}`))
      expect(blocking).toHaveLength(1)
    })

    it('does not block on the reviewed MEDIUM and LOW baseline', () => {
      const { blocking, counts } = classify(parseCsv(withCspAsFullRow(MEDIUM_BODY)))
      expect(blocking).toHaveLength(0)
      expect(counts).toEqual({ LOW: 1, MEDIUM: 3 })
    })

    it('ignores rows with no recognised severity instead of scoring them', () => {
      const csv = withCspAsArtifact(row('F_CHECK', 'MEDIUM'))
      const { findings, artifacts } = classify(parseCsv(csv))
      expect(findings).toHaveLength(1)
      expect(artifacts).toHaveLength(1)
    })
  })

  describe('formatCounts', () => {
    it('orders severities predictably', () => {
      expect(formatCounts({ MEDIUM: 12, LOW: 1 })).toBe('1 LOW, 12 MEDIUM')
    })
  })
})
