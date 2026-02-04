"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerQuizHandlers = void 0;
exports.registerGeneralHandlers = registerGeneralHandlers;
const electron_1 = require("electron");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const constants_1 = require("./constants");
const aiManager_1 = require("../modules/ai/aiManager");
const automationScripts_1 = require("../modules/automation/automationScripts");
const userElementPicker_1 = require("../modules/automation/userElementPicker");
const quizCliHandler_1 = require("../modules/quiz/quizCliHandler");
Object.defineProperty(exports, "registerQuizHandlers", { enumerable: true, get: function () { return quizCliHandler_1.registerQuizHandlers; } });
const getCustomPlatformsPath = () => path_1.default.join(electron_1.app.getPath('userData'), 'ai_custom_platforms.json');
function registerGeneralHandlers() {
    const { IPC_CHANNELS, SCREENSHOT_TYPES } = constants_1.APP_CONFIG;
    electron_1.ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREEN, async (event, rect) => {
        try {
            const win = electron_1.BrowserWindow.fromWebContents(event.sender);
            if (!win || win.isDestroyed())
                return null;
            // If rect provided, capture only that region. Otherwise capture full page
            const image = await win.webContents.capturePage(rect);
            return image.toDataURL();
        }
        catch (error) {
            console.error('[IPC] Screen capture failed:', error);
            return null;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.COPY_IMAGE, async (event, dataUrl) => {
        try {
            if (!dataUrl?.startsWith('data:image/'))
                return false;
            const image = electron_1.nativeImage.createFromDataURL(dataUrl);
            if (image.isEmpty())
                return false;
            electron_1.clipboard.writeImage(image);
            return true;
        }
        catch (error) {
            console.error('[IPC] Clipboard copy failed:', error);
            return false;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (event, url) => {
        if (!url || typeof url !== 'string')
            return false;
        try {
            const parsedUrl = new URL(url);
            const allowedProtocols = ['http:', 'https:', 'mailto:'];
            if (allowedProtocols.includes(parsedUrl.protocol)) {
                await electron_1.shell.openExternal(url);
                return true;
            }
            return false;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[IPC] External link error:`, message);
            return false;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.FORCE_PASTE, async (event, webContentsId) => {
        try {
            if (!webContentsId)
                return false;
            const contents = electron_1.webContents.fromId(webContentsId);
            if (contents && !contents.isDestroyed()) {
                contents.paste();
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('[IPC] Force paste failed:', error);
            return false;
        }
    });
    electron_1.ipcMain.on(IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU, (event, labels = {}) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed())
            return;
        const menu = new electron_1.Menu();
        menu.append(new electron_1.MenuItem({
            label: labels.full_page_screenshot || 'Full Page Screenshot',
            accelerator: 'CmdOrCtrl+S',
            click: () => win.webContents.send(IPC_CHANNELS.TRIGGER_SCREENSHOT, SCREENSHOT_TYPES.FULL)
        }));
        menu.append(new electron_1.MenuItem({
            label: labels.crop_screenshot || 'Crop Screenshot',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => win.webContents.send(IPC_CHANNELS.TRIGGER_SCREENSHOT, SCREENSHOT_TYPES.CROP)
        }));
        menu.append(new electron_1.MenuItem({ type: 'separator' }));
        menu.append(new electron_1.MenuItem({ label: labels.zoom_in || 'Zoom In', role: 'zoomIn' }));
        menu.append(new electron_1.MenuItem({ label: labels.zoom_out || 'Zoom Out', role: 'zoomOut' }));
        menu.append(new electron_1.MenuItem({ label: labels.reset_zoom || 'Reset Zoom', role: 'resetZoom' }));
        menu.append(new electron_1.MenuItem({ type: 'separator' }));
        menu.append(new electron_1.MenuItem({ label: labels.reload || 'Reload', role: 'reload' }));
        menu.popup({ window: win });
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.SAVE_AI_CONFIG, async (event, hostname, config) => {
        try {
            const configPath = path_1.default.join(electron_1.app.getPath('userData'), 'ai_custom_selectors.json');
            let currentConfig = {};
            try {
                const data = await fs_1.promises.readFile(configPath, 'utf8');
                currentConfig = JSON.parse(data);
            }
            catch (e) { }
            currentConfig[hostname] = { ...config, timestamp: Date.now() };
            await fs_1.promises.writeFile(configPath, JSON.stringify(currentConfig, null, 2));
            return true;
        }
        catch (error) {
            console.error('[IPC] Failed to save AI config:', error);
            return false;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.GET_AI_CONFIG, async (event, hostname) => {
        try {
            const configPath = path_1.default.join(electron_1.app.getPath('userData'), 'ai_custom_selectors.json');
            try {
                const data = await fs_1.promises.readFile(configPath, 'utf8');
                const fullConfig = JSON.parse(data);
                return hostname ? fullConfig[hostname] : fullConfig;
            }
            catch (e) {
                return null;
            }
        }
        catch (error) {
            console.error('[IPC] Failed to get AI config:', error);
            return null;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.DELETE_AI_CONFIG, async (event, hostname) => {
        try {
            const configPath = path_1.default.join(electron_1.app.getPath('userData'), 'ai_custom_selectors.json');
            let currentConfig = {};
            try {
                const data = await fs_1.promises.readFile(configPath, 'utf8');
                currentConfig = JSON.parse(data);
            }
            catch (e) { }
            if (currentConfig[hostname]) {
                delete currentConfig[hostname];
                await fs_1.promises.writeFile(configPath, JSON.stringify(currentConfig, null, 2));
            }
            return true;
        }
        catch (error) {
            console.error('[IPC] Failed to delete AI config:', error);
            return false;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.DELETE_ALL_AI_CONFIGS, async () => {
        try {
            const configPath = path_1.default.join(electron_1.app.getPath('userData'), 'ai_custom_selectors.json');
            await fs_1.promises.writeFile(configPath, JSON.stringify({}, null, 2));
            return true;
        }
        catch (error) {
            console.error('[IPC] Failed to delete all AI configs:', error);
            return false;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.ADD_CUSTOM_AI, async (event, platformData) => {
        try {
            const configPath = getCustomPlatformsPath();
            let currentConfig = {};
            try {
                const data = await fs_1.promises.readFile(configPath, 'utf8');
                currentConfig = JSON.parse(data);
            }
            catch (e) { }
            const id = 'custom_' + Date.now();
            let newPlatform = {
                id,
                name: platformData.name,
                url: platformData.url,
                icon: 'globe', // Default
                selectors: { input: null, button: null, waitFor: null },
                isCustom: true,
                color: undefined
            };
            // Check if we can restore icon from inactive platforms
            const lowerUrl = platformData.url.toLowerCase().trim();
            for (const key in aiManager_1.INACTIVE_PLATFORMS) {
                const p = aiManager_1.INACTIVE_PLATFORMS[key];
                if (p.url && (lowerUrl.includes(p.url.replace('https://', '').replace(/\/$/, '')) || p.url.includes(lowerUrl))) {
                    newPlatform.icon = p.icon;
                    newPlatform.color = p.color;
                    break;
                }
            }
            currentConfig[id] = newPlatform;
            await fs_1.promises.writeFile(configPath, JSON.stringify(currentConfig, null, 2));
            return { success: true, id, platform: newPlatform };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[IPC] Failed to add custom AI:', message);
            return { success: false, error: message };
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOM_AI, async (event, id) => {
        try {
            const configPath = getCustomPlatformsPath();
            let currentConfig = {};
            try {
                const data = await fs_1.promises.readFile(configPath, 'utf8');
                currentConfig = JSON.parse(data);
            }
            catch (e) { }
            if (currentConfig[id]) {
                delete currentConfig[id];
                await fs_1.promises.writeFile(configPath, JSON.stringify(currentConfig, null, 2));
                return true;
            }
            return false;
        }
        catch (error) {
            return false;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.GET_AI_REGISTRY, async () => {
        // Load custom platforms
        const configPath = getCustomPlatformsPath();
        let customPlatforms = {};
        try {
            const data = await fs_1.promises.readFile(configPath, 'utf8');
            customPlatforms = JSON.parse(data);
        }
        catch (e) { }
        const mergedRegistry = { ...aiManager_1.AI_REGISTRY, ...customPlatforms };
        const allIds = [...Object.keys(aiManager_1.AI_REGISTRY), ...Object.keys(customPlatforms)];
        return {
            aiRegistry: mergedRegistry,
            defaultAiId: aiManager_1.DEFAULT_AI_ID,
            allAiIds: allIds,
            chromeUserAgent: aiManager_1.CHROME_USER_AGENT
        };
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, (event, action, ...args) => {
        try {
            switch (action) {
                case 'generateFocusScript': {
                    const config = (args[0] || {});
                    return (0, automationScripts_1.generateFocusScript)(config);
                }
                case 'generateClickSendScript': {
                    const config = (args[0] || {});
                    return (0, automationScripts_1.generateClickSendScript)(config);
                }
                case 'generateAutoSendScript': {
                    const config = (args[0] || {});
                    const text = typeof args[1] === 'string' ? args[1] : '';
                    const submit = typeof args[2] === 'boolean' ? args[2] : true;
                    return (0, automationScripts_1.generateAutoSendScript)(config, text, submit);
                }
                case 'generatePickerScript': {
                    const translations = (args[0] || {});
                    return (0, userElementPicker_1.generatePickerScript)(translations);
                }
                default: return null;
            }
        }
        catch (error) {
            console.error('[IPC] Automation script error:', error);
            return null;
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.IS_AUTH_DOMAIN, (event, urlOrHostname) => {
        try {
            // Try to parse as URL to extract hostname
            const parsed = new URL(urlOrHostname);
            return (0, aiManager_1.isAuthDomain)(parsed.hostname);
        }
        catch {
            // If invalid URL (e.g. just "google.com"), assume it's already a hostname
            return (0, aiManager_1.isAuthDomain)(urlOrHostname);
        }
    });
    electron_1.ipcMain.handle(IPC_CHANNELS.CLEAR_CACHE, async () => {
        try {
            await electron_1.session.defaultSession.clearCache();
            return true;
        }
        catch (error) {
            console.error('[IPC] Failed to clear cache:', error);
            return false;
        }
    });
}
