"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
let _aiRegistryCache = null;
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // AI & Automation
    getAiRegistry: async (forceRefresh = false) => {
        if (!_aiRegistryCache || forceRefresh) {
            _aiRegistryCache = await electron_1.ipcRenderer.invoke('get-ai-registry');
        }
        if (!_aiRegistryCache) {
            throw new Error('AI registry not available');
        }
        return _aiRegistryCache;
    },
    isAuthDomain: (url) => electron_1.ipcRenderer.invoke('is-auth-domain', url),
    automation: {
        generateFocusScript: (config) => electron_1.ipcRenderer.invoke('get-automation-scripts', 'generateFocusScript', config),
        generateClickSendScript: (config) => electron_1.ipcRenderer.invoke('get-automation-scripts', 'generateClickSendScript', config),
        generateAutoSendScript: (config, text, submit) => electron_1.ipcRenderer.invoke('get-automation-scripts', 'generateAutoSendScript', config, text, submit),
        generatePickerScript: (translations) => electron_1.ipcRenderer.invoke('get-automation-scripts', 'generatePickerScript', translations)
    },
    // PDF
    selectPdf: (options) => electron_1.ipcRenderer.invoke('select-pdf', options),
    getPdfStreamUrl: (filePath) => electron_1.ipcRenderer.invoke('get-pdf-stream-url', filePath),
    registerPdfPath: (filePath) => electron_1.ipcRenderer.invoke('pdf:register-path', filePath),
    // Utilities
    captureScreen: (rect) => electron_1.ipcRenderer.invoke('capture-screen', rect),
    copyImageToClipboard: (dataUrl) => electron_1.ipcRenderer.invoke('copy-image-to-clipboard', dataUrl),
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    forcePaste: (webContentsId) => electron_1.ipcRenderer.invoke('force-paste-in-webview', webContentsId),
    showPdfContextMenu: (labels) => electron_1.ipcRenderer.send('show-pdf-context-menu', labels),
    // Events
    onTriggerScreenshot: (callback) => {
        const handler = (event, type) => callback(type);
        electron_1.ipcRenderer.on('trigger-screenshot', handler);
        return () => electron_1.ipcRenderer.removeListener('trigger-screenshot', handler);
    },
    // Meta
    platform: process.platform,
    // Updater
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    openReleasesPage: () => electron_1.ipcRenderer.invoke('open-releases-page'),
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    clearCache: () => electron_1.ipcRenderer.invoke('clear-cache'),
    // AI Config
    saveAiConfig: (hostname, config) => electron_1.ipcRenderer.invoke('save-ai-config', hostname, config),
    getAiConfig: (hostname) => electron_1.ipcRenderer.invoke('get-ai-config', hostname),
    deleteAiConfig: (hostname) => electron_1.ipcRenderer.invoke('delete-ai-config', hostname),
    deleteAllAiConfigs: () => electron_1.ipcRenderer.invoke('delete-all-ai-configs'),
    addCustomAi: (data) => electron_1.ipcRenderer.invoke('add-custom-ai', data),
    deleteCustomAi: (id) => electron_1.ipcRenderer.invoke('delete-custom-ai', id),
    // Quiz Generation API
    quiz: {
        generate: (params) => electron_1.ipcRenderer.invoke('generate-quiz-cli', params),
        getSettings: () => electron_1.ipcRenderer.invoke('get-quiz-settings'),
        saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-quiz-settings', settings),
        getCliPath: () => electron_1.ipcRenderer.invoke('get-gemini-cli-path'),
        openLogin: () => electron_1.ipcRenderer.invoke('open-gemini-login'),
        checkAuth: () => electron_1.ipcRenderer.invoke('check-gemini-auth'),
        logout: () => electron_1.ipcRenderer.invoke('gemini-logout'),
        askAssistant: (question, context) => electron_1.ipcRenderer.invoke('ask-ai-assistant', { question, context })
    }
});
