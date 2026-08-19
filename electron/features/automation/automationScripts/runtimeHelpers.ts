import { getBaseHelpers } from './lib/baseHelpers.js'
import { cachingHelpers } from './lib/cachingHelpers.js'
import { confidenceScoring } from './lib/confidenceScoring.js'
import { domSearchHelpers } from './lib/domSearchHelpers.js'
import { errorClassifierRuntime } from './lib/errorClassifierRuntime.js'
import { eventDrivenWaitRuntime } from './lib/eventDrivenWait.js'
import { fallbackHeuristics } from './lib/fallbackHeuristics.js'
import { interactionHelpers } from './lib/interactionHelpers.js'
import { selectorEngine } from './lib/selectorEngine.js'
import { shadowRootRegistryRuntime } from './lib/shadowRootRegistry.js'
import { siteStrategyRuntime } from './lib/siteStrategyRegistry.js'

export function buildCommonHelpers(ambiguousSelectorBehavior: 'pick' | 'reject'): string {
  return [
    getBaseHelpers(ambiguousSelectorBehavior),
    // Sıralama önemli: önce error classifier (selectorEngine kullanır),
    // sonra cache, dom arama, güven skoru, fallback, selector engine.
    errorClassifierRuntime,
    siteStrategyRuntime,
    eventDrivenWaitRuntime,
    cachingHelpers,
    // Shadow root registry, domSearchHelpers'ten ÖNCE gelir (attachShadow hook'u
    // kurar; domSearchHelpers bu hook'a bağımlıdır).
    shadowRootRegistryRuntime,
    domSearchHelpers,
    confidenceScoring,
    fallbackHeuristics,
    selectorEngine,
    interactionHelpers
  ].join('\n')
}
