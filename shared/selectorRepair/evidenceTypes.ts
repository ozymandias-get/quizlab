/**
 * The vocabulary a repair observation is reduced to before any policy runs.
 *
 * Both shapes describe one locator's recovery evidence. `RepairEvidenceInput`
 * is the full record the eligibility policy reads (it adds the locator kind);
 * `SelectorRepairEvidence` is the kind-less form a caller already scoped to a
 * locator, so ranking several records for the same locator does not have to
 * re-attach it.
 */
import type {
  AutomationLookupStrategy,
  ConfidenceLevel,
  SelectorRepairKind
} from '../types/automation.js'

export interface RepairEvidenceInput {
  kind: SelectorRepairKind
  strategy: AutomationLookupStrategy
  confidenceScore: number
  confidenceLevel: ConfidenceLevel
  stableSelector: string | null
  /** True when the two best recovery candidates were within the score gap. */
  ambiguous: boolean
  /** True when the stable selector looked build-generated. */
  unstableSelector: boolean
  /** True when a send-control blocklist rejected the element. */
  blockedSendControl: boolean
  /** True only after the real pipeline operation (typing / submit) succeeded. */
  operationSucceeded: boolean
}

/**
 * A single locator's recovery evidence, reduced to what the policy needs.
 *
 * The renderer builds these from `AutomationSelectorDiagnostics` so evidence
 * selection and promotion share one vocabulary instead of growing a second
 * scoring path.
 */
export interface SelectorRepairEvidence {
  strategy: AutomationLookupStrategy
  confidenceScore: number
  confidenceLevel: ConfidenceLevel
  stableSelector: string | null
  ambiguous: boolean
  unstableSelector: boolean
  blockedSendControl: boolean
  operationSucceeded: boolean
}
