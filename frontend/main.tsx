import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './context/LanguageContext'
import { AiProvider } from './context/AiContext'
import { AppearanceProvider } from './context/AppearanceContext'
import { NavigationProvider } from './context/NavigationContext'
import { UpdateProvider } from './context/UpdateContext'
import { AppToolProvider } from './context/AppToolContext'
import { ToastProvider } from './context/ToastContext'
import { FileProvider } from './context/FileContext'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <LanguageProvider>
            <ToastProvider>
                <AiProvider>
                    <AppToolProvider>
                        <AppearanceProvider>
                            <NavigationProvider>
                                <UpdateProvider>
                                    <FileProvider>
                                        <App />
                                    </FileProvider>
                                </UpdateProvider>
                            </NavigationProvider>
                        </AppearanceProvider>
                    </AppToolProvider>
                </AiProvider>
            </ToastProvider>
        </LanguageProvider>
    </React.StrictMode>
)

