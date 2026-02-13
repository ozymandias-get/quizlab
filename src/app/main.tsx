import ReactDOM from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './providers/LanguageContext'
import { AiProvider } from './providers/AiContext'
import { AppearanceProvider } from './providers/AppearanceContext'
import { UpdateProvider } from './providers/UpdateContext'
import { AppToolProvider } from './providers/AppToolContext'
import { ToastProvider } from './providers/ToastContext'
import '@src/styles/index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <LanguageProvider>
        <ToastProvider>
            <AiProvider>
                <AppToolProvider>
                    <AppearanceProvider>
                        <UpdateProvider>
                            <App />
                        </UpdateProvider>
                    </AppearanceProvider>
                </AppToolProvider>
            </AiProvider>
        </ToastProvider>
    </LanguageProvider>
)
