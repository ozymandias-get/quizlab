"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDev = void 0;
exports.getMainWindow = getMainWindow;
exports.createWindow = createWindow;
exports.getSplashWindow = getSplashWindow;
exports.createSplashWindow = createSplashWindow;
/**
 * Window Manager Module
 */
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const constants_1 = require("./constants");
exports.isDev = !electron_1.app.isPackaged;
const windowStateFile = path_1.default.join(electron_1.app.getPath('userData'), 'window-state.json');
/**
 * Path Resolution Helper
 */
const getAppPath = (...parts) => {
    return exports.isDev
        ? path_1.default.join(__dirname, ...parts)
        : path_1.default.join(electron_1.app.getAppPath(), ...parts);
};
// ============================================
// WINDOW STATE PERSISTENCE
// ============================================
function getDefaultWindowState() {
    return {
        width: constants_1.APP_CONFIG.WINDOW.DEFAULT_WIDTH,
        height: constants_1.APP_CONFIG.WINDOW.DEFAULT_HEIGHT,
        x: undefined,
        y: undefined,
        isMaximized: false
    };
}
function loadWindowState() {
    try {
        if (fs_1.default.existsSync(windowStateFile)) {
            const data = fs_1.default.readFileSync(windowStateFile, 'utf-8');
            return data ? JSON.parse(data) : getDefaultWindowState();
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[WindowState] Load error:', message);
    }
    return getDefaultWindowState();
}
function saveWindowState(window) {
    try {
        if (!window || window.isDestroyed())
            return;
        const isMaximized = window.isMaximized();
        // Use normalBounds if maximized to restore to proper size
        const bounds = isMaximized && window.getNormalBounds ? window.getNormalBounds() : window.getBounds();
        const state = {
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            isMaximized
        };
        fs_1.default.writeFileSync(windowStateFile, JSON.stringify(state, null, 2));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[WindowState] Save error:', message);
    }
}
// ============================================
// MAIN WINDOW
// ============================================
let mainWindow = null;
function getMainWindow() {
    return mainWindow;
}
function createWindow() {
    const windowState = loadWindowState();
    // Monitor positioning
    if (windowState.x !== undefined && windowState.y !== undefined) {
        const display = electron_1.screen.getDisplayMatching(windowState);
        if (display) {
            const { workArea } = display;
            // Ensure width/height fits in workArea
            if (windowState.width > workArea.width)
                windowState.width = workArea.width;
            if (windowState.height > workArea.height)
                windowState.height = workArea.height;
            // Check X bounds
            if (windowState.x + windowState.width > workArea.x + workArea.width) {
                windowState.x = workArea.x + workArea.width - windowState.width;
            }
            if (windowState.x < workArea.x) {
                windowState.x = workArea.x;
            }
            // Check Y bounds
            if (windowState.y + windowState.height > workArea.y + workArea.height) {
                windowState.y = workArea.y + workArea.height - windowState.height;
            }
            if (windowState.y < workArea.y) {
                windowState.y = workArea.y;
            }
        }
        else {
            windowState.x = undefined;
            windowState.y = undefined;
        }
    }
    const iconPath = getAppPath(exports.isDev ? '../../resources' : 'resources', `icon.${process.platform === 'win32' ? 'ico' : 'png'}`);
    mainWindow = new electron_1.BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        minWidth: constants_1.APP_CONFIG.WINDOW.MIN_WIDTH,
        minHeight: constants_1.APP_CONFIG.WINDOW.MIN_HEIGHT,
        icon: iconPath,
        autoHideMenuBar: true,
        backgroundColor: '#0c0a09',
        show: false,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/index.js'), // Compiled preload script
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webviewTag: true,
            webSecurity: true,
            spellcheck: false
        }
    });
    if (!exports.isDev) {
        mainWindow.setMenu(null);
    }
    else {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    if (!exports.isDev) {
        const indexPath = path_1.default.join(electron_1.app.getAppPath(), 'dist', 'index.html');
        mainWindow.loadFile(indexPath).catch(err => {
            electron_1.dialog.showErrorBox('Load Error', `Index not found: ${indexPath}`);
        });
    }
    if (windowState.isMaximized) {
        mainWindow.maximize();
    }
    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.destroy();
            splashWindow = null;
        }
        mainWindow?.show();
    });
    mainWindow.on('close', () => saveWindowState(mainWindow));
    mainWindow.on('closed', () => { mainWindow = null; });
    setupSessions();
    return mainWindow;
}
// ============================================
// SESSIONS
// ============================================
function setupSessions() {
    try {
        const aiSession = electron_1.session.fromPartition(constants_1.APP_CONFIG.PARTITIONS.AI);
        aiSession.webRequest.onBeforeSendHeaders((details, callback) => {
            details.requestHeaders['User-Agent'] = constants_1.APP_CONFIG.CHROME_USER_AGENT;
            callback({ requestHeaders: details.requestHeaders });
        });
        aiSession.setPermissionRequestHandler((webContents, permission, callback) => {
            const allowed = ['notifications', 'media', 'geolocation'];
            callback(allowed.includes(permission));
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Sessions] Error:`, message);
    }
}
// ============================================
// SPLASH WINDOW
// ============================================
let splashWindow = null;
function getSplashWindow() {
    return splashWindow;
}
function createSplashWindow() {
    const splashPath = exports.isDev
        ? path_1.default.join(__dirname, '../../frontend/public/splash.html')
        : path_1.default.join(electron_1.app.getAppPath(), 'dist', 'splash.html');
    splashWindow = new electron_1.BrowserWindow({
        width: 380,
        height: 380,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        center: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    splashWindow.loadFile(splashPath).catch(() => { });
    splashWindow.on('closed', () => { splashWindow = null; });
    return splashWindow;
}
