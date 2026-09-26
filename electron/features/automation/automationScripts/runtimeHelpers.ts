import { getBaseHelpers } from './lib/baseHelpers.js'
import { cachingHelpers } from './lib/cachingHelpers.js'
import { confidenceScoring } from './lib/confidenceScoring.js'
import { domSearchHelpers } from './lib/domSearchHelpers.js'
import { errorClassifierRuntime } from './lib/errorClassifierRuntime.js'
import { eventDrivenWaitRuntime } from './lib/eventDrivenWait.js'
import { fallbackHeuristics } from './lib/fallbackHeuristics.js'
import { interactionHelpers } from './lib/interactionHelpers.js'
import { selectorEngine } from './lib/selectorEngine.js'
import { selectorRepairRuntime } from './lib/selectorRepairRuntime.js'
import { shadowRootRegistryRuntime } from './lib/shadowRootRegistry.js'
import { siteStrategyRuntime } from './lib/siteStrategyRegistry.js'

export function buildCommonHelpers(ambiguousSelectorBehavior: 'pick' | 'reject'): string {
  return [
    getBaseHelpers(ambiguousSelectorBehavior),
    // Sıralama önemli: önce error classifier (selectorEngine kullanır),
    // sonra cache, dom arama, güven skoru, self-heal evidence, fallback,
    // selector engine.
    errorClassifierRuntime,
    siteStrategyRuntime,
    eventDrivenWaitRuntime,
    cachingHelpers,
    // Shadow root registry, domSearchHelpers'ten ÖNCE gelir (attachShadow hook'u
    // kurar; domSearchHelpers bu hook'a bağımlıdır).
    shadowRootRegistryRuntime,
    domSearchHelpers,
    confidenceScoring,
    // Self-healing evidence: send-control blocklist + stable selector
    // re-derivation. Must precede fallbackPipeline (which consumes the
    // blocklist) and selectorEngine (which annotates resolutions).
    selectorRepairRuntime,
    fallbackHeuristics,
    selectorEngine,
    interactionHelpers
  ].join('\n')
}
