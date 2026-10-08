import AppEffects from '@app/effects/AppEffects'
import { TooltipProvider } from '@shared/ui/components/primitives'

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
            <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
          </AppToolProvider>
        </AiProvider>
      </UpdateProvider>
    </QueryProvider>
  )
}

export default AppProviders
