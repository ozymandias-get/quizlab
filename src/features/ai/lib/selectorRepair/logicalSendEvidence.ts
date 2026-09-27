/**
 * Collapses the diagnostics of ONE logical user send into at most one repair
 * observation per locator.
 *
 * The image pipeline runs several injected scripts for a single send (focus,
 * paste, refocus, prompt, submit-ready, click). Those are one user action, not
 * six. Without this step two problems appear:
 *
 *   - a locator could be credited twice in one send (`promptScript` and
 *     `clickScript` both recovering the input) and reach the promotion
 *     threshold off a single message;
 *   - the previous `return`-on-first-persist loop could consume the input
 *     evidence and drop the button evidence entirely.
 *
 * Selection uses the canonical ordering in `shared/selectorRepair.ts`, so the
 * winner never depends on which internal script happened to finish first, and an
 * ambiguous or blocklisted record can never displace a trustworthy one.
 */
import type { SelectorRepairEvidence } from '@shared-core/selectorRepair'
import { compareRepairEvidence } from '@shared-core/selectorRepair'
import type {
  AutomationExecutionDiagnostics,
  AutomationSelectorDiagnostics,
  SelectorRepairKind
} from '@shared-core/types'

import type { AiSendDiagnostics } from '../../model/types'

/**
 * Scripts that performed a real operation and may therefore teach the repair
 * loop. `focusScript`, `refocusScript` and `submitReadyScript` are deliberately
 * excluded: they resolve elements without using them.
 */
const OPERATION_DIAGNOSTICS_KEYS = ['script', 'promptScript', 'clickScript'] as const

/**
 * Reduces one locator's diagnostics to the policy's evidence vocabulary.
 * Anything the runtime could not fill in defaults to the *refused* value, so a
 * partial record can never look more trustworthy than it is.
 */
export function toSelectorRepairEvidence(
  diagnostics: AutomationSelectorDiagnostics
): SelectorRepairEvidence {
  return {
    strategy: diagnostics.strategy,
    confidenceScore:
      typeof diagnostics.confidenceScore === 'number' ? diagnostics.confidenceScore : 0,
    confidenceLevel: diagnostics.confidenceLevel ?? 'low',
    stableSelector: diagnostics.stableSelector ?? null,
    ambiguous: diagnostics.ambiguous === true,
    unstableSelector: diagnostics.unstableSelector === true,
    blockedSendControl: diagnostics.repairReason === 'blocked_send_control',
    operationSucceeded: diagnostics.operationSucceeded === true
  }
}

/**
 * Picks the best record for one locator across every operation script of the
 * send. `null` means no script even produced a record for it.
 */
export function pickBestLocatorEvidence(
  kind: SelectorRepairKind,
  records: ReadonlyArray<AutomationSelectorDiagnostics | undefined>
): AutomationSelectorDiagnostics | null {
  const present = records.filter((record): record is AutomationSelectorDiagnostics =>
    Boolean(record)
  )
  const first = present[0]
  if (!first) return null

  let bestRecord = first
  let bestEvidence = toSelectorRepairEvidence(first)
  for (const record of present.slice(1)) {
    const evidence = toSelectorRepairEvidence(record)
    // `> 0` means the candidate is the better record.
    if (compareRepairEvidence(kind, evidence, bestEvidence) > 0) {
      bestRecord = record
      bestEvidence = evidence
    }
  }
  return bestRecord
}

function collectOperationDiagnostics(
  diagnostics: AiSendDiagnostics
): AutomationExecutionDiagnostics[] {
  const collected: AutomationExecutionDiagnostics[] = []
  for (const key of OPERATION_DIAGNOSTICS_KEYS) {
    const entry = diagnostics[key]
    if (entry) collected.push(entry)
  }
  return collected
}

/**
 * Builds the single diagnostics object the repair policy is evaluated against.
 *
 * @returns one merged record per locator, or `null` when no operation script
 * ran at all (a healthy send, or a send that failed before using anything).
 */
export function aggregateLogicalSendEvidence(
  diagnostics: AiSendDiagnostics
): AutomationExecutionDiagnostics | null {
  const scripts = collectOperationDiagnostics(diagnostics)
  if (scripts.length === 0) return null

  const first = scripts[0] as AutomationExecutionDiagnostics
  const input = pickBestLocatorEvidence(
    'input',
    scripts.map((script) => script.input)
  )
  const button = pickBestLocatorEvidence(
    'button',
    scripts.map((script) => script.button)
  )

  if (!input && !button) return null

  return {
    ...first,
    input: input ?? first.input,
    ...(button ? { button } : {})
  }
}
