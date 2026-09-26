/**
 * Single entry point used by both send pipelines to feed the self-healing loop.
 *
 * Keeping this in one place is what stops `textSendPipeline` and
 * `imageSendPipeline` from each growing their own copy of the repair logic: the
 * pipelines only hand over the diagnostics of a send that already succeeded.
 *
 * Intentionally fire-and-forget and never throwing — a repair is a background
 * improvement, so failing it must never turn a successful send into an error.
 */
import type {
  AiPlatform,
  AiSelectorConfig,
  AutomationExecutionDiagnostics
} from '@shared-core/types'

import { Logger } from '@shared/lib/logger'

import type { QueryClient } from '@tanstack/react-query'

import type { AiSendDiagnostics } from '../../model/types'
import type { ConfigCache } from '../aiSenderSupport'
import { applySelectorRepair, SELECTOR_REPAIR_LOG_PREFIX } from './applySelectorRepair'
import { evaluateSelectorRepairEvidence } from './evaluateRepairEvidence'

export interface ReportSelectorRepairParams {
  aiConfig: AiPlatform | AiSelectorConfig
  currentUrl: string
  diagnostics: AiSendDiagnostics
  queryClient: QueryClient
  configCache: ConfigCache
}

/**
 * The pipeline records each injected script's diagnostics separately
 * (`script`, `focusScript`, `promptScript`, `submitReadyScript`, `clickScript`).
 * Only the ones that performed a *real* operation are allowed to feed the repair
 * loop — a focus or a "wait until ready" run resolves an element without using
 * it, and counting those would promote selectors on a false positive.
 */
const OPERATION_DIAGNOSTICS_KEYS = ['script', 'promptScript', 'clickScript'] as const

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

function extractHostname(currentUrl: string): string | null {
  try {
    return new URL(currentUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Evaluates the evidence of the last successful send and, when a meaningful
 * transition happened, persists the resulting patch.
 *
 * Safe to call on every send: when the saved selector still works, or when the
 * recovery was not trustworthy, it performs no write at all.
 */
export async function reportSelectorRepair(params: ReportSelectorRepairParams): Promise<boolean> {
  const { aiConfig, currentUrl, diagnostics, queryClient, configCache } = params

  try {
    const hostname = extractHostname(currentUrl)
    if (!hostname) return false

    const operationDiagnostics = collectOperationDiagnostics(diagnostics)
    if (operationDiagnostics.length === 0) return false

    for (const scriptDiagnostics of operationDiagnostics) {
      const evaluation = evaluateSelectorRepairEvidence({
        config: aiConfig,
        diagnostics: scriptDiagnostics
      })
      if (!evaluation?.shouldPersist) continue

      const persisted = await applySelectorRepair({
        hostname,
        patch: evaluation.patch,
        queryClient,
        configCache
      })

      if (persisted) {
        Logger.info(
          `${SELECTOR_REPAIR_LOG_PREFIX} ${hostname} promoted=${evaluation.promoted} ` +
            `input=${evaluation.reasons.input} button=${evaluation.reasons.button}`
        )
        // The in-memory config is now stale; the next send must re-read it.
        return true
      }
    }

    return false
  } catch (err) {
    Logger.error(`${SELECTOR_REPAIR_LOG_PREFIX} evaluation failed`, err)
    return false
  }
}
