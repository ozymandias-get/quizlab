import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import type { WebviewElement } from '@shared-core/types/webview'
import type { ElectronApi } from '@shared-core/types/ipcContract'
import type {
  SubmitMode,
  AiSelectorConfig,
  AiPlatform,
  AiRegistryResponse,
  PdfSelectOptions,
  PdfSelection,
  PdfStreamResult,
  UpdateCheckResult,
  CustomAiInput,
  CustomAiResult,
  GeminiWebSessionStatus,
  GeminiWebSessionActionResult,
  ScreenshotType,
  AutomationConfig,
  PdfFile,
  PdfViewerZoomAction
} from '@shared-core/types'
export type {
  SubmitMode,
  AiSelectorConfig,
  AiPlatform,
  AiRegistryResponse,
  PdfSelectOptions,
  PdfSelection,
  PdfStreamResult,
  UpdateCheckResult,
  CustomAiInput,
  CustomAiResult,
  GeminiWebSessionStatus,
  GeminiWebSessionActionResult,
  ScreenshotType,
  AutomationConfig,
  PdfFile,
  PdfViewerZoomAction
}

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
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<
        HTMLAttributes<WebviewElement> & {
          src?: string
          partition?: string
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
