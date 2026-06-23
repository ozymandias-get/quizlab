import type { ElectronApi, WaitForSubmitReadyOptions } from '@shared-core/types/ipcContract'

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { onEvent, typedInvoke, unwrapIpcResult } from '../../shared/lib/typedIpcPreload'

const electronApi: ElectronApi = {
  getAiRegistry: (forceRefresh?) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.GET_AI_REGISTRY, forceRefresh)),
  isAuthDomain: (url) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.IS_AUTH_DOMAIN, url)),
  automation: {
    generateFocusScript: (config) =>
      unwrapIpcResult(
        typedInvoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generateFocusScript', config)
      ),
    generateClickSendScript: (config) =>
      unwrapIpcResult(
        typedInvoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generateClickSendScript', config)
      ),
    generateAutoSendScript: (config, text, submit, append, textInputMode, typingSpeed) =>
      unwrapIpcResult(
        typedInvoke(
          IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
          'generateAutoSendScript',
          config,
          text,
          submit,
          append === true,
          textInputMode,
          typingSpeed
        )
      ),
    generateValidateSelectorsScript: (config) =>
      unwrapIpcResult(
        typedInvoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generateValidateSelectorsScript', config)
      ),
    generateWaitForSubmitReadyScript: (config, options?) =>
      unwrapIpcResult(
        typedInvoke(
          IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
          'generateWaitForSubmitReadyScript',
          config,
          options
        )
      ),
    generatePickerScript: (translations) =>
      unwrapIpcResult(
        typedInvoke(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, 'generatePickerScript', translations)
      )
  },

  selectPdf: (options?) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.SELECT_PDF, options)),
  selectFolder: (options?) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.SELECT_FOLDER, options)),
  getPdfStreamUrl: (filePath) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.GET_PDF_STREAM_URL, filePath)),
  registerPdfPath: (filePath) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.PDF_REGISTER_PATH, filePath)),

  captureScreen: (rect?) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.CAPTURE_SCREEN, rect)),
  copyImageToClipboard: (dataUrl) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.COPY_IMAGE, dataUrl)),
  copyTextToClipboard: (text) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.COPY_TEXT, text)),
  openExternal: (url) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.OPEN_EXTERNAL, url)),
  forcePaste: (webContentsId) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.FORCE_PASTE, webContentsId)),
  showPdfContextMenu: (labels) => ipcRenderer.send(IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU, labels),

  onTriggerScreenshot: (callback) => {
    const handler = (_event: IpcRendererEvent, type: unknown) =>
      callback(type as Parameters<Parameters<ElectronApi['onTriggerScreenshot']>[0]>[0])
    ipcRenderer.on(IPC_CHANNELS.TRIGGER_SCREENSHOT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRIGGER_SCREENSHOT, handler)
  },
  onPdfViewerZoom: (callback) => {
    const handler = (_event: IpcRendererEvent, action: unknown) =>
      callback(action as Parameters<Parameters<ElectronApi['onPdfViewerZoom']>[0]>[0])
    ipcRenderer.on(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, handler)
  },

  get platform() {
    return process.platform
  },
  quitApp: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.APP_QUIT)),

  checkForUpdates: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.CHECK_FOR_UPDATES)),
  openReleasesPage: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.OPEN_RELEASES)),
  getAppVersion: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GET_APP_VERSION)),
  clearCache: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.CLEAR_CACHE)),
  clearAiModelData: (input) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.CLEAR_AI_MODEL_DATA, input)),
  getCacheInfo: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.CACHE_INFO)),
  deepCleanCache: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.DEEP_CLEAN_CACHE)),

  saveAiConfig: (hostname, config) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.SAVE_AI_CONFIG, hostname, config)),
  getAiConfig: (hostname?) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GET_AI_CONFIG, hostname)),
  deleteAiConfig: (hostname) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.DELETE_AI_CONFIG, hostname)),
  addCustomAi: (data) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.ADD_CUSTOM_AI, data)),
  deleteCustomAi: (id) => unwrapIpcResult(typedInvoke(IPC_CHANNELS.DELETE_CUSTOM_AI, id)),

  getApiChatConfig: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GET_API_CHAT_CONFIG)),
  saveApiChatConfig: (config) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.SAVE_API_CHAT_CONFIG, config)),
  sendApiChatRequest: (messages, selectedModel?, generalPrompt?, providerId?) =>
    unwrapIpcResult(
      typedInvoke(
        IPC_CHANNELS.SEND_API_CHAT_REQUEST,
        messages,
        selectedModel,
        generalPrompt,
        providerId
      )
    ),
  fetchApiChatModels: (providerId) =>
    unwrapIpcResult(typedInvoke(IPC_CHANNELS.FETCH_API_CHAT_MODELS, providerId)),
  cancelApiChatRequest: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.CANCEL_API_CHAT_REQUEST)),

  geminiWeb: {
    getStatus: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_STATUS)),
    openLogin: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_OPEN_LOGIN)),
    checkNow: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_CHECK_NOW)),
    reauth: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_REAUTH)),
    resetProfile: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE)),
    setEnabled: (enabled) =>
      unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED, enabled)),
    setEnabledApps: (enabledAppIds) =>
      unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS, enabledAppIds)),
    exportSession: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_EXPORT_SESSION)),
    importSession: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.GEMINI_WEB_IMPORT_SESSION)),
    onRefreshEvent: (callback) => {
      const channels = [
        IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_STARTED,
        IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_SUCCESS,
        IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_FAILED
      ] as const
      const cleanups = channels.map((ch) => onEvent(ch, (payload) => callback(payload)))
      return () => {
        for (const c of cleanups) c()
      }
    }
  },

  nativeMessaging: {
    getStatus: () => unwrapIpcResult(typedInvoke(IPC_CHANNELS.NATIVE_MESSAGING_STATUS)),
    getBridgeConfig: () =>
      unwrapIpcResult(typedInvoke(IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG)),
    installExtension: () =>
      unwrapIpcResult(typedInvoke(IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION)),
    removeExtension: () =>
      unwrapIpcResult(typedInvoke(IPC_CHANNELS.NATIVE_MESSAGING_REMOVE_EXTENSION)),
    onExtensionConnected: (callback) =>
      onEvent(IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_CONNECTED, () => callback()),
    onExtensionDisconnected: (callback) =>
      onEvent(IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_DISCONNECTED, () => callback())
  },

  log: (level, message, timestamp) => {
    ipcRenderer.send(IPC_CHANNELS.LOGGER_LOG, { level, message, timestamp })
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronApi)
