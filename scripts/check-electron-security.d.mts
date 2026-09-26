/**
 * Types for the Electron hardening gate.
 *
 * The gate runs as a plain script, but its report parsing is unit tested — the
 * CSV it reads is unstable enough that the parsing needs to be pinned down.
 */

export interface ElectronegativityRow {
  issue?: string
  severity?: string
  confidence?: string
  filename?: string
  location?: string
  sample?: string
  description?: string
  url?: string
  [key: string]: string | undefined
}

export interface Classification {
  /** Rows carrying a severity the tool actually emits. */
  findings: ElectronegativityRow[]
  /** Rows with no recognisable severity: grade line, partial CSP row. */
  artifacts: ElectronegativityRow[]
  /** Findings at HIGH or CRITICAL; any of these fails the build. */
  blocking: ElectronegativityRow[]
  counts: Record<string, number>
}

/** Reads the electronegativity CSV, locating the header by content. */
export declare function parseCsv(text: string): ElectronegativityRow[]

export declare function classify(rows: ElectronegativityRow[]): Classification

export declare function formatCounts(counts: Record<string, number>): string
