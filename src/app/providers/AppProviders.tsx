import React from 'react'
import { LanguageProvider } from './LanguageContext'
import { AiProvider } from './AiContext'
import { AppearanceProvider } from './AppearanceContext'
import { UpdateProvider } from './UpdateContext'
import { AppToolProvider } from './AppToolContext'
import { ToastProvider } from './ToastContext'
import { QueryProvider } from './QueryProvider'

interface AppProvidersProps {
    children: React.ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    return (
        <QueryProvider>
            <LanguageProvider>
                <ToastProvider>
                    <AiProvider>
                        <AppToolProvider>
                            <AppearanceProvider>
                                <UpdateProvider>
                                    {children}
                                </UpdateProvider>
                            </AppearanceProvider>
                        </AppToolProvider>
                    </AiProvider>
                </ToastProvider>
            </LanguageProvider>
        </QueryProvider>
    )
}
