import { ipcMain, BrowserWindow, shell, Menu, MenuItem, clipboard, nativeImage, app, session, webContents } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { APP_CONFIG } from './constants'
import {
    AI_REGISTRY,
    DEFAULT_AI_ID,
    isAuthDomain,
    CHROME_USER_AGENT,
    INACTIVE_PLATFORMS,
    type AiPlatform,
    type AiSelectorConfig
} from '../modules/ai/aiManager'
import { generateFocusScript, generateClickSendScript, generateAutoSendScript, type AutomationConfig } from '../modules/automation/automationScripts'
import { generatePickerScript } from '../modules/automation/userElementPicker'
import { registerQuizHandlers } from '../modules/quiz/quizCliHandler'

type StoredAiConfig = AiSelectorConfig & { timestamp?: number }
type AiConfigMap = Record<string, StoredAiConfig>
type CustomPlatformsMap = Record<string, AiPlatform>
type AddCustomAiInput = { name: string; url: string }

const getCustomPlatformsPath = () => path.join(app.getPath('userData'), 'ai_custom_platforms.json')

/**
 * Registers all general IPC handlers for communication between renderer and main process.
 * 
 * This function sets up handlers for:
 * - Screen capture (full page and region)
 * - Clipboard operations
 * - External link opening
 * - AI configuration management (Magic Selector settings)
 * - Custom AI platform management
 * - Automation script generation
 * 
 * All handlers use `ipcMain.handle()` which returns a Promise to the renderer.
 */
export function registerGeneralHandlers() {
    const { IPC_CHANNELS, SCREENSHOT_TYPES } = APP_CONFIG

    /**
     * Captures a screenshot of the current window or a specific region.
     * 
     * @param rect - Optional rectangle defining the capture region. If omitted, captures the full page.
     * @returns Base64 encoded data URL of the captured image, or null if capture fails.
     * 
     * Used by: Screenshot tool, diagram capture feature
     */
    ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREEN, async (event, rect?: Electron.Rectangle) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender)
            if (!win || win.isDestroyed()) return null

            // If rect provided, capture only that region. Otherwise capture full page
            const image = await win.webContents.capturePage(rect)
            return image.toDataURL()
        } catch (error) {
            console.error('[IPC] Screen capture failed:', error)
            return null
        }
    })

    ipcMain.handle(IPC_CHANNELS.COPY_IMAGE, async (event, dataUrl: string) => {
        try {
            if (!dataUrl?.startsWith('data:image/')) return false
            const image = nativeImage.createFromDataURL(dataUrl)
            if (image.isEmpty()) return false
            clipboard.writeImage(image)
            return true
        } catch (error) {
            console.error('[IPC] Clipboard copy failed:', error)
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (event, url: string) => {
        if (!url || typeof url !== 'string') return false
        try {
            const parsedUrl = new URL(url)
            const allowedProtocols = ['http:', 'https:', 'mailto:']
            if (allowedProtocols.includes(parsedUrl.protocol)) {
                await shell.openExternal(url)
                return true
            }
            return false
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(`[IPC] External link error:`, message)
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.FORCE_PASTE, async (event, webContentsId: number) => {
        try {
            if (!webContentsId) return false
            const contents = webContents.fromId(webContentsId)

            if (contents && !contents.isDestroyed()) {
                contents.paste()
                return true
            }
            return false
        } catch (error) {
            console.error('[IPC] Force paste failed:', error)
            return false
        }
    })

    ipcMain.on(IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU, (event, labels: Partial<Record<string, string>> = {}) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win || win.isDestroyed()) return

        const menu = new Menu()
        menu.append(new MenuItem({
            label: labels.full_page_screenshot || 'Full Page Screenshot',
            accelerator: 'CmdOrCtrl+S',
            click: () => win.webContents.send(IPC_CHANNELS.TRIGGER_SCREENSHOT, SCREENSHOT_TYPES.FULL)
        }))
        menu.append(new MenuItem({
            label: labels.crop_screenshot || 'Crop Screenshot',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => win.webContents.send(IPC_CHANNELS.TRIGGER_SCREENSHOT, SCREENSHOT_TYPES.CROP)
        }))
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ label: labels.zoom_in || 'Zoom In', role: 'zoomIn' }))
        menu.append(new MenuItem({ label: labels.zoom_out || 'Zoom Out', role: 'zoomOut' }))
        menu.append(new MenuItem({ label: labels.reset_zoom || 'Reset Zoom', role: 'resetZoom' }))
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ label: labels.reload || 'Reload', role: 'reload' }))
        menu.popup({ window: win })
    })

    /**
     * Saves Magic Selector configuration for a specific AI platform.
     * 
     * This stores the CSS selectors that the app uses to interact with an AI website:
     * - Input field selector (where to type text)
     * - Send button selector (what to click to submit)
     * - Optional wait selector (element to wait for before considering the page ready)
     * 
     * @param hostname - The hostname of the AI website (e.g., "chat.openai.com")
     * @param config - The selector configuration object
     * @returns true if save succeeds, false otherwise
     * 
     * Storage: Saved to userData directory as 'ai_custom_selectors.json'
     */
    ipcMain.handle(IPC_CHANNELS.SAVE_AI_CONFIG, async (event, hostname: string, config: AiSelectorConfig) => {
        try {
            const configPath = path.join(app.getPath('userData'), 'ai_custom_selectors.json')
            let currentConfig: AiConfigMap = {}
            try {
                const data = await fs.readFile(configPath, 'utf8')
                currentConfig = JSON.parse(data) as AiConfigMap
            } catch (e) { }

            currentConfig[hostname] = { ...config, timestamp: Date.now() }
            await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2))
            return true
        } catch (error) {
            console.error('[IPC] Failed to save AI config:', error)
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.GET_AI_CONFIG, async (event, hostname?: string) => {
        try {
            const configPath = path.join(app.getPath('userData'), 'ai_custom_selectors.json')
            try {
                const data = await fs.readFile(configPath, 'utf8')
                const fullConfig = JSON.parse(data) as AiConfigMap
                return hostname ? fullConfig[hostname] : fullConfig
            } catch (e) {
                return null
            }
        } catch (error) {
            console.error('[IPC] Failed to get AI config:', error)
            return null
        }
    })

    ipcMain.handle(IPC_CHANNELS.DELETE_AI_CONFIG, async (event, hostname: string) => {
        try {
            const configPath = path.join(app.getPath('userData'), 'ai_custom_selectors.json')
            let currentConfig: AiConfigMap = {}
            try {
                const data = await fs.readFile(configPath, 'utf8')
                currentConfig = JSON.parse(data) as AiConfigMap
            } catch (e) { }

            if (currentConfig[hostname]) {
                delete currentConfig[hostname]
                await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2))
            }
            return true
        } catch (error) {
            console.error('[IPC] Failed to delete AI config:', error)
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.DELETE_ALL_AI_CONFIGS, async () => {
        try {
            const configPath = path.join(app.getPath('userData'), 'ai_custom_selectors.json')
            await fs.writeFile(configPath, JSON.stringify({}, null, 2))
            return true
        } catch (error) {
            console.error('[IPC] Failed to delete all AI configs:', error)
            return false
        }
    })

    /**
     * Adds a custom AI platform to the registry.
     * 
     * This allows users to add AI websites that aren't pre-configured in the app.
     * The function:
     * 1. Generates a unique ID for the platform
     * 2. Creates a platform object with default settings
     * 3. Checks if the URL matches any inactive platforms to restore their icon
     * 4. Saves to the custom platforms file
     * 
     * @param platformData - Object with name and url for the new platform
     * @returns Object with success status, generated ID, and platform details
     * 
     * Storage: Saved to userData directory as 'ai_custom_platforms.json'
     * 
     * Example:
     * addCustomAi({ name: "My Local LLM", url: "http://localhost:8080" })
     */
    ipcMain.handle(IPC_CHANNELS.ADD_CUSTOM_AI, async (event, platformData: AddCustomAiInput) => {
        try {
            const configPath = getCustomPlatformsPath()
            let currentConfig: CustomPlatformsMap = {}
            try {
                const data = await fs.readFile(configPath, 'utf8')
                currentConfig = JSON.parse(data) as CustomPlatformsMap
            } catch (e) { }

            const id = 'custom_' + Date.now()
            let newPlatform: AiPlatform = {
                id,
                name: platformData.name,
                url: platformData.url,
                icon: 'globe', // Default
                selectors: { input: null, button: null, waitFor: null },
                isCustom: true,
                color: undefined as string | undefined
            }

            // Check if we can restore icon from inactive platforms
            const lowerUrl = platformData.url.toLowerCase().trim()
            for (const key in INACTIVE_PLATFORMS) {
                const p = INACTIVE_PLATFORMS[key]
                if (p.url && (lowerUrl.includes(p.url.replace('https://', '').replace(/\/$/, '')) || p.url.includes(lowerUrl))) {
                    newPlatform.icon = p.icon
                    newPlatform.color = p.color
                    break
                }
            }

            currentConfig[id] = newPlatform
            await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2))
            return { success: true, id, platform: newPlatform }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('[IPC] Failed to add custom AI:', message)
            return { success: false, error: message }
        }
    })

    ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOM_AI, async (event, id: string) => {
        try {
            const configPath = getCustomPlatformsPath()
            let currentConfig: CustomPlatformsMap = {}
            try {
                const data = await fs.readFile(configPath, 'utf8')
                currentConfig = JSON.parse(data) as CustomPlatformsMap
            } catch (e) { }

            if (currentConfig[id]) {
                delete currentConfig[id]
                await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2))
                return true
            }
            return false
        } catch (error) {
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.GET_AI_REGISTRY, async () => {
        // Load custom platforms
        const configPath = getCustomPlatformsPath()
        let customPlatforms: CustomPlatformsMap = {}
        try {
            const data = await fs.readFile(configPath, 'utf8')
            customPlatforms = JSON.parse(data) as CustomPlatformsMap
        } catch (e) { }

        const mergedRegistry: Record<string, AiPlatform> = { ...AI_REGISTRY, ...customPlatforms }
        const allIds = [...Object.keys(AI_REGISTRY), ...Object.keys(customPlatforms)]

        return {
            aiRegistry: mergedRegistry,
            defaultAiId: DEFAULT_AI_ID,
            allAiIds: allIds,
            chromeUserAgent: CHROME_USER_AGENT
        }
    })

    /**
     * Generates JavaScript code for automating interactions with AI websites.
     * 
     * This is the core of the Magic Selector feature. It generates scripts that:
     * - Focus on input fields
     * - Click send buttons
     * - Auto-fill and submit text
     * - Show the element picker UI
     * 
     * @param action - The type of script to generate
     * @param args - Additional arguments specific to each action type
     * @returns Generated JavaScript code as a string, or null if action is invalid
     * 
     * Actions:
     * - 'generateFocusScript': Creates code to focus an input field
     * - 'generateClickSendScript': Creates code to click the send button
     * - 'generateAutoSendScript': Creates code to fill text and submit
     * - 'generatePickerScript': Creates the UI for selecting elements on the page
     * 
     * The generated code is executed in the webview using executeJavaScript()
     */
    ipcMain.handle(IPC_CHANNELS.GET_AUTOMATION_SCRIPTS, (event, action: string, ...args: unknown[]) => {
        try {
            switch (action) {
                case 'generateFocusScript': {
                    const config = (args[0] || {}) as AutomationConfig
                    return generateFocusScript(config)
                }
                case 'generateClickSendScript': {
                    const config = (args[0] || {}) as AutomationConfig
                    return generateClickSendScript(config)
                }
                case 'generateAutoSendScript': {
                    const config = (args[0] || {}) as AutomationConfig
                    const text = typeof args[1] === 'string' ? args[1] : ''
                    const submit = typeof args[2] === 'boolean' ? args[2] : true
                    return generateAutoSendScript(config, text, submit)
                }
                case 'generatePickerScript': {
                    const translations = (args[0] || {}) as Record<string, string>
                    return generatePickerScript(translations)
                }
                default: return null
            }
        } catch (error) {
            console.error('[IPC] Automation script error:', error)
            return null
        }
    })

    ipcMain.handle(IPC_CHANNELS.IS_AUTH_DOMAIN, (event, urlOrHostname: string) => {
        try {
            // Try to parse as URL to extract hostname
            const parsed = new URL(urlOrHostname)
            return isAuthDomain(parsed.hostname)
        } catch {
            // If invalid URL (e.g. just "google.com"), assume it's already a hostname
            return isAuthDomain(urlOrHostname)
        }
    })

    ipcMain.handle(IPC_CHANNELS.CLEAR_CACHE, async () => {
        try {
            await session.defaultSession.clearCache()
            return true
        } catch (error) {
            console.error('[IPC] Failed to clear cache:', error)
            return false
        }
    })
}

export { registerQuizHandlers }
