import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProviders } from './providers'
import '@src/styles/index.css'

import { registerPWA } from './pwa'

registerPWA()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <AppProviders>
        <App />
    </AppProviders>
)
