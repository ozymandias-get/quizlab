import { getBaseHelpers } from './helpers/baseHelpers'
import { cachingHelpers } from './helpers/cachingHelpers'
import { domSearchHelpers } from './helpers/domSearchHelpers'
import { fallbackHeuristics } from './helpers/fallbackHeuristics'
import { interactionHelpers } from './helpers/interactionHelpers'

export function buildCommonHelpers(ambiguousSelectorBehavior: 'pick' | 'reject'): string {
  return [
    getBaseHelpers(ambiguousSelectorBehavior),
    cachingHelpers,
    domSearchHelpers,
    fallbackHeuristics,
    interactionHelpers
  ].join('\n')
}
