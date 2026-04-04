import type { ReactNode } from 'react'
import { AiProvider } from './AiContext'
import { AppToolProvider } from './AppToolContext'
import { QueryProvider } from './QueryProvider'
import { UpdateProvider } from './UpdateContext'
import { AppEffects } from '@app/effects/AppEffects'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <UpdateProvider>
        <AppEffects />
        <AiProvider>
          <AppToolProvider>{children}</AppToolProvider>
        </AiProvider>
      </UpdateProvider>
    </QueryProvider>
  )
}
