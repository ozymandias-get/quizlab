import { getBaseHelpers } from './lib/baseHelpers'
import { cachingHelpers } from './lib/cachingHelpers'
import { confidenceScoring } from './lib/confidenceScoring'
import { domSearchHelpers } from './lib/domSearchHelpers'
import { errorClassifierRuntime } from './lib/errorClassifierRuntime'
import { eventDrivenWaitRuntime } from './lib/eventDrivenWait'
import { fallbackHeuristics } from './lib/fallbackHeuristics'
import { interactionHelpers } from './lib/interactionHelpers'
import { selectorEngine } from './lib/selectorEngine'
import { siteStrategyRuntime } from './lib/siteStrategyRegistry'

export function buildCommonHelpers(ambiguousSelectorBehavior: 'pick' | 'reject'): string {
  return [
    getBaseHelpers(ambiguousSelectorBehavior),
    // Sıralama önemli: önce error classifier (selectorEngine kullanır),
    // sonra cache, dom arama, güven skoru, fallback, selector engine.
    errorClassifierRuntime,
    siteStrategyRuntime,
    eventDrivenWaitRuntime,
    cachingHelpers,
    domSearchHelpers,
    confidenceScoring,
    fallbackHeuristics,
    selectorEngine,
    interactionHelpers
  ].join('\n')
}
