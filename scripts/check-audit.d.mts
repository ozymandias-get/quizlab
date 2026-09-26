/**
 * Types for the production audit gate.
 *
 * The gate runs as a plain script, but its validation logic is unit tested, so
 * it is exported and needs a declaration for `tsc` to typecheck the tests.
 */

export interface AuditFinding {
  name: string
  severity: string
  advisoryIds: string[]
}

export interface AcceptedException {
  package?: string
  installed?: string
  severity?: string
  advisories?: string[]
  reason?: string | string[]
  expires?: string
  [key: string]: unknown
}

/** Extracts GHSA and CVE ids from an audit report's `via` entries. */
export declare function advisoryIdsOf(via: unknown[]): string[]

/**
 * Reports why an exception no longer describes the finding it accepts, so the
 * caller can surface every problem at once. An empty array means it holds.
 */
export declare function validateException(
  exception: AcceptedException,
  finding: AuditFinding,
  shippedVersion: string | undefined
): string[]
