import React from 'react'
import { AiProvider } from './AiContext'
import { AppToolProvider } from './AppToolContext'
import { QueryProvider } from './QueryProvider'
import { AppEffects } from '@app/effects/AppEffects'

interface AppProvidersProps {
    children: React.ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <QueryProvider>
            <AppEffects />
            <AiProvider>
                <AppToolProvider>
                    {children}
                </AppToolProvider>
            </AiProvider>
        </QueryProvider>
    )
}

