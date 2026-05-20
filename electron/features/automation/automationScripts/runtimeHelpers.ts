import { getBaseHelpers } from './helpers/baseHelpers'
import { cachingHelpers } from './helpers/cachingHelpers'
import { confidenceScoring } from './helpers/confidenceScoring'
import { domSearchHelpers } from './helpers/domSearchHelpers'
import { fallbackHeuristics } from './helpers/fallbackHeuristics'
import { interactionHelpers } from './helpers/interactionHelpers'
import { selectorEngine } from './helpers/selectorEngine'

export function buildCommonHelpers(ambiguousSelectorBehavior: 'pick' | 'reject'): string {
  return [
    getBaseHelpers(ambiguousSelectorBehavior),
    cachingHelpers,
    domSearchHelpers,
    confidenceScoring,
    fallbackHeuristics,
    selectorEngine,
    interactionHelpers
  ].join('\n')
}
