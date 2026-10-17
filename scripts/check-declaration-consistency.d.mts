/**
 * Types for the declaration consistency gate.
 *
 * The gate runs as a plain script, but its range parsing and its two checks are
 * unit tested, so the helpers are exported and need declarations for `tsc -b`
 * to typecheck the tests. Deleting this file should break the build rather than
 * let the tests fall back to `any`.
 */

export interface NodeFloorInput {
  /** `package.json` `engines.node`; absent or non-string is itself a finding. */
  enginesNode?: string
  /** Document filename to its text; `null` means the file is not on disk. */
  docs?: Record<string, string | null>
  /**
   * `.github/workflows/build.yml` text. Omit to skip the CI pin check so the
   * document rules can be exercised on their own; pass it — including an empty
   * string, which is what a missing workflow file looks like — to run it.
   */
  workflow?: string
}

export interface DeclaredFloorsInput {
  /** Merged `dependencies` and `devDependencies`, exactly as declared. */
  declared?: Record<string, string>
  /** Installed version per package name; absent means not installed. */
  installed?: Record<string, string | undefined>
}

/** The version a declared range refuses to resolve below, or null if unreadable. */
export declare function rangeFloor(range: unknown): string | null

/** The lowest version a declared range admits, e.g. `24.15.0`. */
export declare function minimumVersion(range: unknown): string | null

/** Whether some release with that major is admitted by the range at all. */
export declare function admitsMajor(range: unknown, major: unknown): boolean

/**
 * Every way the declared Node floor and the statements of it disagree, so the
 * caller can surface all of them at once. An empty array means they agree.
 */
export declare function checkNodeFloorAgreement(input: NodeFloorInput): string[]

/**
 * Every direct dependency whose declared floor is not the installed version,
 * plus every direct dependency that is not installed. Empty means they match.
 */
export declare function checkDeclaredFloors(input: DeclaredFloorsInput): string[]
