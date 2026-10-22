import type {
  AiPlatform,
  AiRegistryResponse,
  AiSelectorConfig,
  CustomAiInput,
  CustomAiResult,
  NativeMessagingExtensionInfo,
  UpdateCheckResult
} from '@shared-core/types'

import { parseUrlWithAllowedProtocols } from '@shared/lib/urlUtils'

import {
  getPlatform,
  registerBeforeUnloadCleanup,
  selectPdfInBrowser,
  toMapRecord
} from './browserApiUtils'
import { WEB_AI_REGISTRY } from './web-ai-registry'

const stubReturn =
  <T>(val: T) =>
  async () =>
    val

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

    // Browsers (Chromium, Firefox) only reliably support image/png for Async Clipboard write
    let pngBlob = blob
    if (blob.type !== 'image/png' && typeof document !== 'undefined') {
      try {
        const img = new Image()
        img.src = dataUrl
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const converted = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/png')
          )
          if (converted) pngBlob = converted
        }
      } catch {
        // Fallback to original blob if conversion fails
      }
    }

    const clipboardItem = new ClipboardItem({ [pngBlob.type]: pngBlob })
    await navigator.clipboard.write([clipboardItem])
    return true
  } catch {
    return writeToClipboard(dataUrl)
  }
}

export function createBrowserElectronApi(): Window['electronAPI'] {
  const aiConfigs = new Map<string, AiSelectorConfig>()
  const customPlatforms = new Map<string, AiPlatform>()

  registerBeforeUnloadCleanup()

  const getAiRegistry = async (): Promise<AiRegistryResponse> => {
    const aiRegistry: Record<string, AiPlatform> = {
      ...WEB_AI_REGISTRY,
      ...toMapRecord(customPlatforms)
    }

    const allAiIds = Object.keys(aiRegistry)

    return {
      aiRegistry,
      defaultAiId: allAiIds.includes('chatgpt') ? 'chatgpt' : (allAiIds[0] ?? ''),
      allAiIds,
      chromeUserAgent: navigator.userAgent
    }
  }

  return {
    getAiRegistry,

    automation: {
      generateFocusScript: stubReturn(null),
      generateClickSendScript: stubReturn(null),
      generateAutoSendScript: stubReturn(null),
      generateValidateSelectorsScript: stubReturn(null),
      generateWaitForSubmitReadyScript: stubReturn(null),
      generatePickerScript: stubReturn(null)
    },

    selectPdf: async () => selectPdfInBrowser(),
    getPdfStreamUrl: stubReturn(null),
    registerPdfPath: stubReturn(null),
    onShellOpenPdf: () => () => {},
    shellIntegration: {
      getStatus: stubReturn(null),
      install: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      remove: stubReturn({ success: false, error: 'web_dev_mode_only' })
    },

    captureScreen: stubReturn(null),
    // Tarayıcı modunda gerçek bir pano snapshot'ı yoktur; `scope` yalnızca
    // sözleşme uyumu için kabul edilir ve yok sayılır.
    copyImageToClipboard: (dataUrl: string, _scope?: string) => writeImageToClipboard(dataUrl),
    restoreClipboard: stubReturn(true),
    copyTextToClipboard: (text: string) => writeToClipboard(text),
    openExternal: async (url: string) => {
      const parsedUrl = parseUrlWithAllowedProtocols(url, ['http:', 'https:', 'mailto:'])
      if (!parsedUrl) return false
      window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer')
      return true
    },

    showPdfContextMenu: () => {},
    onTriggerScreenshot: () => () => {},
    onPdfViewerZoom: () => () => {},

    platform: getPlatform(),
    quitApp: async () => true,

    checkForUpdates: stubReturn({ available: false, cached: true } as UpdateCheckResult),
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
    setCacheAutoClean: stubReturn(true),
    smartCacheAction: stubReturn(true),

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

    getAppSettings: stubReturn(null),
    saveAppSetting: stubReturn(true),

    // Chrome session sharing needs the extension bridge, which the browser dev
    // server has no equivalent for: the list is empty and every action fails
    // with the code that says "this only works in the desktop app".
    siteSession: {
      list: stubReturn({
        accountViews: [],
        extensionConnected: false,
        extensionVersionOk: false
      }),
      setAccountEnabled: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      clearAccount: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      setActiveAccount: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      renameAccount: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      deleteAccount: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      resolvePending: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      onChanged: () => () => {}
    },
    nativeMessaging: {
      getStatus: stubReturn({
        status: 'disconnected',
        installed: false
      } as NativeMessagingExtensionInfo),
      installExtension: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      removeExtension: stubReturn({ success: false, error: 'web_dev_mode_only' }),
      onExtensionConnected: () => () => {},
      onExtensionDisconnected: () => () => {}
    },
    // Remote provider sites need a main-process WebContentsView, which the
    // browser dev server has no equivalent for. Every entry point fails closed
    // so the AI panel degrades to a permanent load state instead of pretending.
    aiView: {
      attach: () => Promise.reject(new Error('web_dev_mode_only')),
      detach: stubReturn(false),
      destroy: stubReturn(false),
      reload: stubReturn(false),
      loadUrl: stubReturn(false),
      navigate: stubReturn(false),
      getUrl: stubReturn(null),
      executeScript: () => Promise.reject(new Error('web_dev_mode_only')),
      insertText: stubReturn(false),
      sendInputEvent: stubReturn(false),
      paste: stubReturn(false),
      focus: stubReturn(false),
      syncHost: () => {},
      onEvent: () => () => {}
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
