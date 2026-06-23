import type { ElectronApi } from '@shared-core/types/ipcContract'
import type { WebviewElement } from '@shared-core/types/webview'

import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  interface WebViewHTMLAttributes<T> {
    allowpopups?: string | boolean | undefined
  }
}

declare global {
  interface ImportMetaEnv {
    readonly MODE: string
    readonly BASE_URL: string
    readonly PROD: boolean
    readonly DEV: boolean
    readonly SSR: boolean
    readonly [key: string]: string | boolean | undefined
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }

  interface Window {
    electronAPI: ElectronApi
    __APP_VERSION__: string
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<
        HTMLAttributes<WebviewElement> & {
          src?: string
          partition?: string
          /**
           * Electron's `<webview>` accepts a string token for `allowpopups`.
           * The declared type stays narrow (`boolean | string`) because React's
           * `DetailedHTMLProps` filters unknown attributes; call sites that
           * need to pass a string must use a documented cast (see
           * `AiSession.tsx` / `GoogleDrivePanel.tsx`).
           */
          allowpopups?: boolean | string
          webpreferences?: string
          useragent?: string
          preload?: string
          httpreferrer?: string
          disablewebsecurity?: string
          nodeintegration?: string
          plugins?: string
        },
        WebviewElement
      >
    }
  }
}
