import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import type { WebviewElement } from '@shared-core/types/webview'
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
import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

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

declare global {
  interface Window {
    electronAPI: {
      getAiRegistry: (forceRefresh?: boolean) => Promise<AiRegistryResponse>
      isAuthDomain: (url: string) => Promise<boolean>
      automation: {
        generateFocusScript: (config: AiSelectorConfig) => Promise<string | null>
        generateClickSendScript: (config: AiSelectorConfig) => Promise<string | null>
        generateAutoSendScript: (
          config: AiSelectorConfig,
          text: string,
          submit: boolean,
          append?: boolean
        ) => Promise<string | null>
        generateValidateSelectorsScript: (config: AiSelectorConfig) => Promise<string | null>
        generateWaitForSubmitReadyScript: (
          config: AiSelectorConfig,
          options?: { timeoutMs?: number; settleMs?: number; minimumWaitMs?: number }
        ) => Promise<string | null>
        generatePickerScript: (translations: Record<string, string>) => Promise<string | null>
      }

      selectPdf: (options: PdfSelectOptions) => Promise<PdfSelection | null>
      getPdfStreamUrl: (filePath: string) => Promise<PdfStreamResult | null>
      registerPdfPath: (filePath: string) => Promise<PdfSelection | null>

      captureScreen: (rect?: {
        x: number
        y: number
        width: number
        height: number
      }) => Promise<string | null>
      copyImageToClipboard: (dataUrl: string) => Promise<boolean>
      copyTextToClipboard: (text: string) => Promise<boolean>
      openExternal: (url: string) => Promise<boolean>
      forcePaste: (webContentsId: number) => Promise<boolean>
      showPdfContextMenu: (labels: Partial<Record<string, string>>) => void

      onTriggerScreenshot: (callback: (type: ScreenshotType) => void) => () => void
      onPdfViewerZoom: (callback: (action: PdfViewerZoomAction) => void) => () => void

      platform: string
      quitApp: () => Promise<void>

      checkForUpdates: () => Promise<UpdateCheckResult>
      openReleasesPage: () => Promise<void>
      getAppVersion: () => Promise<string>
      clearCache: () => Promise<boolean>

      saveAiConfig: (hostname: string, config: AiSelectorConfig) => Promise<boolean>
      getAiConfig: (
        hostname?: string
      ) => Promise<AiSelectorConfig | Record<string, AiSelectorConfig> | null>
      deleteAiConfig: (hostname: string) => Promise<boolean>
      addCustomAi: (data: CustomAiInput) => Promise<CustomAiResult>
      deleteCustomAi: (id: string) => Promise<boolean>

      geminiWeb: {
        getStatus: () => Promise<GeminiWebSessionStatus>
        openLogin: () => Promise<GeminiWebSessionActionResult>
        checkNow: () => Promise<GeminiWebSessionActionResult>
        reauth: () => Promise<GeminiWebSessionActionResult>
        resetProfile: () => Promise<GeminiWebSessionActionResult>
        setEnabled: (enabled: boolean) => Promise<GeminiWebSessionActionResult>
        setEnabledApps: (
          enabledAppIds: GoogleWebSessionAppId[]
        ) => Promise<GeminiWebSessionActionResult>
      }
    }
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
