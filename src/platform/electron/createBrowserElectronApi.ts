import {
  GOOGLE_WEB_SESSION_REGISTRY_IDS,
  type GoogleWebSessionAppId
} from '@shared-core/constants/google-ai-web-apps'
import type {
  AiPlatform,
  AiRegistryResponse,
  AiSelectorConfig,
  CustomAiInput,
  CustomAiResult,
  GeminiWebSessionActionResult,
  GeminiWebSessionStatus,
  NativeMessagingExtensionInfo,
  UpdateCheckResult
} from '@shared-core/types'

import {
  createGeminiStatus,
  getPlatform,
  parseUrlWithAllowedProtocols,
  registerBeforeUnloadCleanup,
  selectPdfInBrowser,
  toMapRecord
} from './browser-api-utils'
import { WEB_AI_REGISTRY } from './web-ai-registry'

const stubReturn =
  <T>(val: T) =>
  async () =>
    val

const webDevOnlyError = (): GeminiWebSessionActionResult => ({
  success: false,
  error: 'web_dev_mode_only'
})

const writeToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Tarayıcı modunda resim data URL'sini panoya gerçek bir resim olarak
 * yazmayı dener. ClipboardItem API'si desteklenmiyorsa (Firefox gibi),
 * writeText ile data URL'yi ham metin olarak yazmaya çalışır.
 */
const writeImageToClipboard = async (dataUrl: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard?.write) return writeToClipboard(dataUrl)

    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const clipboardItem = new ClipboardItem({ [blob.type]: blob })
    await navigator.clipboard.write([clipboardItem])
    return true
  } catch {
    return writeToClipboard(dataUrl)
  }
}

export function createBrowserElectronApi(): Window['electronAPI'] {
  const aiConfigs = new Map<string, AiSelectorConfig>()
  const customPlatforms = new Map<string, AiPlatform>()
  let geminiWebEnabled = false
  let geminiWebEnabledAppIds: GoogleWebSessionAppId[] = [...GOOGLE_WEB_SESSION_REGISTRY_IDS]

  registerBeforeUnloadCleanup()

  const getAiRegistry = async (): Promise<AiRegistryResponse> => {
    const aiRegistry: Record<string, AiPlatform> = {
      ...WEB_AI_REGISTRY,
      ...toMapRecord(customPlatforms)
    }

    const enabledAppIds = new Set(geminiWebEnabledAppIds)
    for (const appId of GOOGLE_WEB_SESSION_REGISTRY_IDS) {
      if (!geminiWebEnabled || !enabledAppIds.has(appId)) {
        delete aiRegistry[appId]
      }
    }

    const allAiIds = Object.keys(aiRegistry)

    return {
      aiRegistry,
      defaultAiId: allAiIds.includes('chatgpt') ? 'chatgpt' : allAiIds[0] || 'chatgpt',
      allAiIds,
      chromeUserAgent: navigator.userAgent
    }
  }

  const getGeminiStatus = (): GeminiWebSessionStatus =>
    createGeminiStatus(geminiWebEnabled, geminiWebEnabledAppIds)

  return {
    getAiRegistry,
    isAuthDomain: stubReturn(false),

    automation: {
      generateFocusScript: stubReturn(null),
      generateClickSendScript: stubReturn(null),
      generateAutoSendScript: stubReturn(null),
      generateValidateSelectorsScript: stubReturn(null),
      generateWaitForSubmitReadyScript: stubReturn(null),
      generatePickerScript: stubReturn(null)
    },

    selectPdf: async () => selectPdfInBrowser(),
    selectFolder: stubReturn(null),
    getPdfStreamUrl: stubReturn(null),
    registerPdfPath: stubReturn(null),

    captureScreen: stubReturn(null),
    copyImageToClipboard: (dataUrl: string) => writeImageToClipboard(dataUrl),
    copyTextToClipboard: (text: string) => writeToClipboard(text),
    openExternal: async (url: string) => {
      const parsedUrl = parseUrlWithAllowedProtocols(url, ['http:', 'https:', 'mailto:'])
      if (!parsedUrl) return false
      window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer')
      return true
    },

    forcePaste: stubReturn(false),
    showPdfContextMenu: () => {},
    onTriggerScreenshot: () => () => {},
    onPdfViewerZoom: () => () => {},

    platform: getPlatform(),
    quitApp: async () => true,

    checkForUpdates: stubReturn({ available: false, cached: true } as UpdateCheckResult),
    openReleasesPage: async () => true,
    getAppVersion: stubReturn('dev-web'),
    clearCache: stubReturn(true),
    clearAiModelData: stubReturn(true),
    getCacheInfo: stubReturn({
      breakdown: {
        chromiumCache: 0,
        codeCache: 0,
        gpuCache: 0,
        partitionCaches: {},
        tempFiles: 0,
        total: 0
      },
      lastCleanup: null,
      lastCleanupResult: null,
      isIdle: false
    }),
    deepCleanCache: stubReturn(true),

    saveAiConfig: async (hostname, config) => {
      aiConfigs.set(hostname, config)
      return true
    },
    getAiConfig: async (hostname) => {
      if (hostname) return aiConfigs.get(hostname) || null
      return toMapRecord(aiConfigs)
    },
    deleteAiConfig: async (hostname) => aiConfigs.delete(hostname),
    addCustomAi: async (input: CustomAiInput): Promise<CustomAiResult> => {
      const name = input?.name?.trim()
      const url = input?.url?.trim()
      const parsedUrl = url ? parseUrlWithAllowedProtocols(url, ['http:', 'https:']) : null
      if (!name || !parsedUrl) {
        return { ok: false, error: { code: 'invalid_input', message: 'invalid_input' } }
      }

      const id = `custom_${self.crypto.randomUUID()}`
      const platform: AiPlatform = {
        id,
        name,
        displayName: name,
        url: parsedUrl.toString(),
        isSite: input.isSite ?? true,
        isCustom: true,
        submitMode: 'enter_key'
      }
      customPlatforms.set(id, platform)
      return { ok: true, data: { id, platform } }
    },
    deleteCustomAi: async (id) => customPlatforms.delete(id),

    geminiWeb: {
      getStatus: async () => getGeminiStatus(),
      resetProfile: async () => ({ success: true, status: getGeminiStatus() }),
      setEnabled: async (enabled: boolean) => {
        geminiWebEnabled = enabled
        return { success: true, status: getGeminiStatus() }
      },
      setEnabledApps: async (enabledAppIds: GoogleWebSessionAppId[]) => {
        const validIds = new Set(GOOGLE_WEB_SESSION_REGISTRY_IDS)
        const nextIds: GoogleWebSessionAppId[] = []

        for (const appId of enabledAppIds) {
          if (!validIds.has(appId)) continue
          if (nextIds.includes(appId)) continue
          nextIds.push(appId)
        }

        geminiWebEnabledAppIds = nextIds
        return { success: true, status: getGeminiStatus() }
      },
      exportSession: async () => webDevOnlyError(),
      importSession: async () => webDevOnlyError(),
      onRefreshEvent: () => () => {}
    },
    nativeMessaging: {
      getStatus: stubReturn({
        status: 'disconnected',
        installed: false
      } as NativeMessagingExtensionInfo),
      installExtension: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      removeExtension: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      getBridgeConfig: () => Promise.resolve(null),
      onExtensionConnected: () => () => {},
      onExtensionDisconnected: () => () => {}
    },
    getApiChatConfig: stubReturn({
      providers: [],
      generalPrompt: '',
      memoryPrompt: '',
      characterPrompt: '',
      selectedProviderId: '',
      selectedModel: ''
    }),
    saveApiChatConfig: stubReturn(true),
    sendApiChatRequest: async () => ({
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: 'API Chat is not available in browser mode. Please run the app in Electron.',
      timestamp: Date.now()
    }),
    fetchApiChatModels: stubReturn([]),
    cancelApiChatRequest: stubReturn(true),

    log: () => {}
  }
}
