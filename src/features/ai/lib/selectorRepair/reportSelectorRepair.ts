/**
 * Self-healing orchestrator: the single entry point both send pipelines use to
 * feed the repair loop.
 *
 * Responsibilities, in order:
 *
 *   1. **Aggregate** one logical user send into at most one observation per
 *      locator (see `logicalSendEvidence.ts`). Cheap and synchronous, so the
 *      healthy path — where nothing drifted — costs nothing and never queues.
 *   2. **Serialize** per hostname (see `repairQueue.ts`) so two sends finishing
 *      close together cannot both read the same counter and lose an update.
 *   3. **Re-read the latest persisted config** inside the queue, immediately
 *      before evaluating. The `aiConfig` snapshot handed over by the pipeline
 *      was resolved at the *start* of the send and is stale by the time the
 *      repair runs; without the re-read, serialization alone would merely
 *      serialize two writes of the same wrong value.
 *   4. **Evaluate + persist** through the existing config domain.
 *
 * Fire-and-forget by design: the caller's `void` means a user never waits on a
 * repair, and this function never rejects, so a background failure can never
 * turn a successful send into an error.
 */
import type {
  AiPlatform,
  AiSelectorConfig,
  AutomationExecutionDiagnostics
} from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'
import { Logger } from '@shared/lib/logger'

import type { QueryClient } from '@tanstack/react-query'

import type { AiSendDiagnostics } from '../../model/types'
import type { ConfigCache } from '../aiSenderSupport'
import { applySelectorRepair, SELECTOR_REPAIR_LOG_PREFIX } from './applySelectorRepair'
import { evaluateSelectorRepairEvidence } from './evaluateRepairEvidence'
import { aggregateLogicalSendEvidence } from './logicalSendEvidence'
import { enqueueSelectorRepair } from './repairQueue'

export interface ReportSelectorRepairParams {
  /** Config snapshot resolved at the *start* of the send; only a fallback. */
  aiConfig: AiPlatform | AiSelectorConfig
  currentUrl: string
  diagnostics: AiSendDiagnostics
  queryClient: QueryClient
  configCache: ConfigCache
}

function extractHostname(currentUrl: string): string | null {
  try {
    return new URL(currentUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Narrows the API's config-or-map union to a single selector config. */
function asSingleSelectorConfig(
  value: AiSelectorConfig | Record<string, AiSelectorConfig> | null
): AiSelectorConfig | null {
  if (!value || typeof value !== 'object') return null
  // A map has hostnames as keys; a single config carries selector fields.
  return 'input' in value || 'button' in value ? (value as AiSelectorConfig) : null
}

/**
 * True when the persisted locators no longer match the send-time snapshot —
 * i.e. somebody (a manual re-pick, a competing promotion) replaced the
 * selectors this evidence was captured against. Only the primaries are
 * compared: a re-pick always regenerates them, and identical primaries mean
 * identical locators, in which case the evidence is still about this config.
 * An unavailable send-time snapshot fails open (previous behavior).
 */
function hasLocatorIdentityMoved(
  sendTime: AiSelectorConfig | null,
  latest: AiSelectorConfig
): boolean {
  if (!sendTime) return false
  return sendTime.input !== latest.input || sendTime.button !== latest.button
}

/**
 * Reads the current persisted config for a hostname straight from the main
 * process, bypassing React Query and the renderer's `ConfigCache` so a queued
 * repair can never observe its own previous write as stale.
 *
 * @returns the latest config, or `null` when it cannot be read.
 */
async function readLatestSelectorConfig(hostname: string): Promise<AiSelectorConfig | null> {
  try {
    const api = getElectronApi()
    if (!api) return null
    return asSingleSelectorConfig(await api.getAiConfig(hostname))
  } catch (err) {
    Logger.warn(`${SELECTOR_REPAIR_LOG_PREFIX} could not re-read ${hostname}`, err)
    return null
  }
}

async function processRepair(params: {
  hostname: string
  evidence: AutomationExecutionDiagnostics
  aiConfig: AiPlatform | AiSelectorConfig
  queryClient: QueryClient
  configCache: ConfigCache
}): Promise<boolean> {
  const { hostname, evidence, aiConfig, queryClient, configCache } = params

  // Read *inside* the queue: the previous task has already persisted, so this
  // sees its own result and the streak advances instead of oscillating.
  const latest = await readLatestSelectorConfig(hostname)
  const baseConfig = latest ?? aiConfig

  // Compare-and-swap: the evidence was captured against the send-time
  // locators. If the persisted primaries moved since (manual re-pick, another
  // promotion), the evidence is stale and must never overwrite the newer
  // manual selection — not even as a staged candidate.
  if (latest && hasLocatorIdentityMoved(asSingleSelectorConfig(aiConfig), latest)) {
    Logger.info(
      `${SELECTOR_REPAIR_LOG_PREFIX} ${hostname} dropping stale evidence (locators changed since capture)`
    )
    return false
  }

  const evaluation = evaluateSelectorRepairEvidence({
    config: baseConfig,
    diagnostics: evidence
  })
  if (!evaluation?.shouldPersist) return false

  const persisted = await applySelectorRepair({
    hostname,
    patch: evaluation.patch,
    queryClient,
    configCache
  })
  if (!persisted) return false

  Logger.info(
    `${SELECTOR_REPAIR_LOG_PREFIX} ${hostname} promoted=${evaluation.promoted} ` +
      `input=${evaluation.reasons.input} button=${evaluation.reasons.button}`
  )
  return true
}

/**
 * Queues one logical send's repair evidence for evaluation.
 *
 * @returns true when this send produced and persisted a repair transition.
 */
export function reportSelectorRepair(params: ReportSelectorRepairParams): Promise<boolean> {
  const { aiConfig, currentUrl, diagnostics, queryClient, configCache } = params

  try {
    const hostname = extractHostname(currentUrl)
    if (!hostname) return Promise.resolve(false)

    // Synchronous and cheap: a send that used no recovered locator never
    // touches the queue or the disk.
    const evidence = aggregateLogicalSendEvidence(diagnostics)
    if (!evidence) return Promise.resolve(false)

    return enqueueSelectorRepair(hostname, () =>
      processRepair({ hostname, evidence, aiConfig, queryClient, configCache })
    ).catch((err: unknown) => {
      // Failure isolation: log and return. The queue tail is never rejected, so
      // the next send for this host still runs.
      Logger.error(`${SELECTOR_REPAIR_LOG_PREFIX} repair failed for ${hostname}`, err)
      return false
    })
  } catch (err) {
    Logger.error(`${SELECTOR_REPAIR_LOG_PREFIX} evaluation failed`, err)
    return Promise.resolve(false)
  }
}
