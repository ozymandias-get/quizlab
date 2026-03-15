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
  DifficultyType,
  ModelTypeEnum,
  QuestionStyleEnum,
  QuizSettings,
  QuizGenerateResult,
  QuizCliPathResult,
  QuizAuthResult,
  QuizActionResult,
  GeminiWebSessionStatus,
  GeminiWebSessionActionResult,
  ScreenshotType,
  AutomationConfig,
  PdfFile
} from '@shared-core/types'
import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

// Re-export types for usage in other files
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
  DifficultyType,
  ModelTypeEnum,
  QuestionStyleEnum,
  QuizSettings,
  QuizGenerateResult,
  QuizCliPathResult,
  QuizAuthResult,
  QuizActionResult,
  GeminiWebSessionStatus,
  GeminiWebSessionActionResult,
  ScreenshotType,
  AutomationConfig,
  PdfFile
}

declare global {
  interface Window {
    electronAPI: {
      // AI & Automation
      getAiRegistry: (forceRefresh?: boolean) => Promise<AiRegistryResponse>
      isAuthDomain: (url: string) => Promise<boolean>
      automation: {
        generateFocusScript: (config: AiSelectorConfig) => Promise<string | null>
        generateClickSendScript: (config: AiSelectorConfig) => Promise<string | null>
        generateAutoSendScript: (
          config: AiSelectorConfig,
          text: string,
          submit: boolean
        ) => Promise<string | null>
        generateValidateSelectorsScript: (config: AiSelectorConfig) => Promise<string | null>
        generateWaitForSubmitReadyScript: (
          config: AiSelectorConfig,
          options?: { timeoutMs?: number; settleMs?: number; minimumWaitMs?: number }
        ) => Promise<string | null>
        generatePickerScript: (translations: Record<string, string>) => Promise<string | null>
      }

      // PDF
      selectPdf: (options: PdfSelectOptions) => Promise<PdfSelection | null>
      getPdfStreamUrl: (filePath: string) => Promise<PdfStreamResult | null>
      registerPdfPath: (filePath: string) => Promise<PdfSelection | null>

      // Utilities
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

      // Events
      onTriggerScreenshot: (callback: (type: ScreenshotType) => void) => () => void

      // Meta
      platform: string
      quitApp: () => Promise<void>

      // Updater
      checkForUpdates: () => Promise<UpdateCheckResult>
      openReleasesPage: () => Promise<void>
      getAppVersion: () => Promise<string>
      clearCache: () => Promise<boolean>

      // AI Config
      saveAiConfig: (hostname: string, config: AiSelectorConfig) => Promise<boolean>
      getAiConfig: (
        hostname?: string
      ) => Promise<AiSelectorConfig | Record<string, AiSelectorConfig> | null>
      deleteAiConfig: (hostname: string) => Promise<boolean>
      addCustomAi: (data: CustomAiInput) => Promise<CustomAiResult>
      deleteCustomAi: (id: string) => Promise<boolean>

      // Quiz Generation API
      quiz: {
        generate: (params: Record<string, unknown>) => Promise<QuizGenerateResult>
        getSettings: () => Promise<QuizSettings>
        saveSettings: (settings: Partial<QuizSettings>) => Promise<boolean>
        getCliPath: () => Promise<QuizCliPathResult>
        openLogin: () => Promise<QuizActionResult>
        checkAuth: () => Promise<QuizAuthResult>
        logout: () => Promise<QuizActionResult>
        askAssistant: (
          question: string,
          context?: string
        ) => Promise<{
          success: boolean
          data?: { answer: string; suggestions?: string[] }
          error?: string
        }>
      }

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

  // Electron Webview element type declaration for JSX
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<WebviewElement> & {
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
