import { lazy } from 'react'

import { getAllTutorials } from './model/tutorialDefinitions'
import type { TutorialEntry, TutorialOverlayProps } from './model/types'

const MagicSelectorTutorial = lazy(() => import('./ui/MagicSelectorTutorial'))
const TutorialOverlay = lazy(() => import('./ui/TutorialOverlay'))

const TUTORIAL_REGISTRY = new Map<string, TutorialEntry>(
  getAllTutorials().map((def) => {
    if (def.id === 'magic-selector') {
      return [
        def.id,
        {
          definition: def,
          component: MagicSelectorTutorial as React.ComponentType<TutorialOverlayProps>
        }
      ]
    }
    return [
      def.id,
      {
        definition: def,
        component: TutorialOverlay as React.ComponentType<TutorialOverlayProps>
      }
    ]
  })
)

export function getTutorialEntry(id: string): TutorialEntry | undefined {
  return TUTORIAL_REGISTRY.get(id)
}
