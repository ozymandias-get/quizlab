import AppEffects from '@app/effects/AppEffects'
import { TooltipProvider } from '@shared/ui/components/primitives'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

import { AiProvider } from './ai-context'
import AppToolProvider from './AppToolContext'
import QueryProvider from './QueryProvider'
import UpdateProvider from './UpdateContext'

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <UpdateProvider>
        <AppEffects />
        <AiProvider>
          <AppToolProvider>
            {/* The stylesheet already collapses CSS keyframes and transitions
                for reduced motion. Motion's JS animations are separate, so the
                same preference is applied here once for every motion component:
                transform/layout animations are dropped, opacity still fades. */}
            <MotionConfig reducedMotion="user">
              <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
            </MotionConfig>
          </AppToolProvider>
        </AiProvider>
      </UpdateProvider>
    </QueryProvider>
  )
}

export default AppProviders
