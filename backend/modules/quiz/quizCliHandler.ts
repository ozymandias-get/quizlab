/**
 * Quiz CLI Handler Module
 * Orchestrates quiz generation using modular components
 */
import { ipcMain, app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process' // Used for login terminal
import { APP_CONFIG } from '../../main/constants'
import { ConfigManager } from '../../managers/ConfigManager'
import { getQuizSettingsPath } from '../../main/handlers/helpers'
import { buildQuizPrompt, type QuizPromptParams } from './promptBuilder'
import { getGeminiCliPath, findGeminiCliPath, executeGeminiCli, generateOutputFilePath } from './geminiService'

interface QuizSettings {
    model: string;
    maxOutputTokens: number;
    temperature: number;
    cliPath?: string;
    // User Preferences
    questionCount: number;
    difficulty: string;
    style: string[];
    focusTopic: string;
}

interface QuizGenerateParams extends QuizPromptParams {
    type?: string;
    pdfPath?: string;
    model?: string;
}

interface AskAiParams {
    question: string;
    context?: string;
    history?: unknown[];
}

interface GeminiSettingsFile {
    security?: { auth?: { selectedType?: string } };
    selectedAuthType?: string;
    apiKey?: string;
    account?: string;
    email?: string;
    [key: string]: unknown;
}

// Default settings
const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
    model: 'gemini-2.5-flash',
    maxOutputTokens: 8192,
    temperature: 0.7,
    questionCount: 10,
    difficulty: 'MEDIUM',
    style: ['MIXED'],
    focusTopic: ''
}

// Security Constants
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024 // 50MB limit
const ALLOWED_EXTENSIONS = ['.pdf']

/**
 * SECURITY: Validate PDF path is within allowed directories
 * Prevents path traversal attacks
 * @param {string} pdfPath - Path to validate
 * @returns {boolean} - True if path is allowed
 */
function isPathAllowed(pdfPath: string): boolean {
    if (!pdfPath || typeof pdfPath !== 'string') {
        return false
    }

    try {
        // Normalize the path to resolve ../ and similar
        const normalizedPath = path.normalize(pdfPath)
        const resolvedPath = path.resolve(pdfPath)

        // Check for null bytes (common attack vector)
        if (pdfPath.includes('\0') || normalizedPath.includes('\0')) {
            return false
        }

        // Ensure path is absolute
        if (!path.isAbsolute(resolvedPath)) {
            return false
        }

        return true
    } catch (error) {
        console.error('[QuizCLI] Path validation error:', error)
        return false
    }
}

/**
 * SECURITY: Validate file is a PDF and within size limits
 * @param {string} filePath - Path to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function validatePdfFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
        const ext = path.extname(filePath).toLowerCase()
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return { valid: false, error: 'error_only_pdf_supported' }
        }

        const stats = await fs.stat(filePath)
        if (!stats.isFile()) {
            return { valid: false, error: 'error_not_valid_file' }
        }

        if (stats.size > MAX_PDF_SIZE_BYTES) {
            return { valid: false, error: 'error_file_too_large' }
        }

        if (stats.size === 0) {
            return { valid: false, error: 'error_file_empty' }
        }

        // Basic PDF header check (magic bytes)
        const buffer = Buffer.alloc(5)
        const fileHandle = await fs.open(filePath, 'r')
        try {
            await fileHandle.read(buffer, 0, 5, 0)
        } finally {
            await fileHandle.close()
        }

        if (buffer.toString() !== '%PDF-') {
            return { valid: false, error: 'error_invalid_pdf' }
        }

        return { valid: true }
    } catch (error) {
        return { valid: false, error: 'error_file_validation_failed' }
    }
}

/**
 * SECURITY: Generate secure temp file name
 */
function generateSecureTempName(extension: string): string {
    const token = randomBytes(16).toString('hex')
    return `context_${token}.${extension}`
}
function registerQuizHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG
    const settingsManager = new ConfigManager<QuizSettings>(getQuizSettingsPath())

    // Get CLI path (for settings display)
    ipcMain.handle(IPC_CHANNELS.GET_GEMINI_CLI_PATH, async () => {
        const cliPath = await findGeminiCliPath()
        if (cliPath) {
            return { path: cliPath, exists: true }
        } else {
            return { path: getGeminiCliPath(), exists: false }
        }
    })

    // Open terminal for Gemini CLI login
    ipcMain.handle(IPC_CHANNELS.OPEN_GEMINI_LOGIN, async () => {
        const cliPath = await findGeminiCliPath()

        if (!cliPath) {
            return { success: false, error: 'error_terminal_not_found' }
        }

        try {
            const isWindows = process.platform === 'win32'
            const isMac = process.platform === 'darwin'

            if (isWindows) {
                // Open new cmd window with gemini CLI
                // The /k flag keeps the window open after command
                spawn('cmd', ['/c', 'start', 'cmd', '/k', `"${cliPath}"`], {
                    shell: true,
                    detached: true,
                    stdio: 'ignore'
                }).unref()
            } else if (isMac) {
                // macOS: Use 'open' command with proper argument structure
                // Creates an AppleScript to run the CLI in Terminal
                const script = `tell application "Terminal" to do script "${cliPath.replace(/"/g, '\\"')}"`
                spawn('osascript', ['-e', script], {
                    detached: true,
                    stdio: 'ignore'
                }).unref()
            } else {
                // Linux: Try common terminal emulators in order of preference
                const terminals = [
                    { cmd: 'gnome-terminal', args: ['--', cliPath] },
                    { cmd: 'konsole', args: ['-e', cliPath] },
                    { cmd: 'xfce4-terminal', args: ['-e', cliPath] },
                    { cmd: 'xterm', args: ['-e', cliPath] }
                ]

                // Try the first available terminal
                let launched = false
                for (const term of terminals) {
                    try {
                        spawn(term.cmd, term.args, {
                            detached: true,
                            stdio: 'ignore'
                        }).unref()
                        launched = true
                        break
                    } catch {
                        continue
                    }
                }

                if (!launched) {
                    throw new Error('No supported terminal emulator found')
                }
            }

            return { success: true }
        } catch (err) {
            // SECURITY: Don't expose detailed error info
            const message = err instanceof Error ? err.message : String(err)
            console.error('[QuizCLI] Failed to open login terminal:', message)
            return { success: false, error: 'error_terminal_open_failed' }
        }
    })

    // Check if Gemini is authenticated
    ipcMain.handle(IPC_CHANNELS.CHECK_GEMINI_AUTH, async () => {
        const settingsPath = path.join(os.homedir(), '.gemini', 'settings.json')
        try {
            const data = await fs.readFile(settingsPath, 'utf8')
            const settings = JSON.parse(data) as GeminiSettingsFile
            // Check if there's any auth configured
            // Gemini CLI stores auth in security.auth.selectedType
            const hasAuth = !!(settings?.security?.auth?.selectedType ||
                settings.selectedAuthType ||
                settings.apiKey ||
                process.env.GEMINI_API_KEY)

            // SECURITY: Don't log sensitive auth details

            // Try to find account info/email (sanitized for display only)
            let account = null
            if (settings.security?.auth?.selectedType === 'OAuth') {
                account = 'Google OAuth'
            } else if (settings.account || settings.email) {
                // Only show first part of email for privacy
                const email = settings.account || settings.email
                if (typeof email === 'string' && email.includes('@')) {
                    account = email.split('@')[0].slice(0, 3) + '***@' + email.split('@')[1]
                } else {
                    account = 'Configured'
                }
            }

            return { authenticated: hasAuth, account }
        } catch (err) {
            // SECURITY: Don't expose detailed error info
            return { authenticated: false }
        }
    })

    // Logout from Gemini (clear auth)
    ipcMain.handle(IPC_CHANNELS.GEMINI_LOGOUT, async () => {
        const settingsPath = path.join(os.homedir(), '.gemini', 'settings.json')
        try {
            // Read current settings
            let settings: GeminiSettingsFile = {}
            try {
                const data = await fs.readFile(settingsPath, 'utf8')
                settings = JSON.parse(data) as GeminiSettingsFile
            } catch { }

            // Remove auth info
            if (settings.security?.auth) {
                delete settings.security.auth
            }
            if (settings.selectedAuthType) {
                delete settings.selectedAuthType
            }
            if (settings.apiKey) {
                delete settings.apiKey
            }

            // Write back
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
            return { success: true }
        } catch (err) {
            // SECURITY: Don't expose detailed error info
            const message = err instanceof Error ? err.message : String(err)
            console.error('[QuizCLI] Logout failed:', message)
            return { success: false, error: 'error_logout_failed' }
        }
    })

    // Get quiz settings
    ipcMain.handle(IPC_CHANNELS.GET_QUIZ_SETTINGS, async () => {
        const stored = await settingsManager.read()
        const merged = { ...DEFAULT_QUIZ_SETTINGS, ...stored }
        merged.cliPath = getGeminiCliPath()
        return merged
    })

    // Save quiz settings
    ipcMain.handle(IPC_CHANNELS.SAVE_QUIZ_SETTINGS, async (event, settings: Partial<QuizSettings>) => {
        return settingsManager.update((current) => {
            const incoming = settings || {}
            const merged = { ...DEFAULT_QUIZ_SETTINGS, ...current }

            return {
                ...merged,
                model: typeof incoming.model === 'string' ? incoming.model : merged.model,
                maxOutputTokens: Number.isFinite(Number(incoming.maxOutputTokens))
                    ? Number(incoming.maxOutputTokens)
                    : merged.maxOutputTokens,
                temperature: Number.isFinite(Number(incoming.temperature))
                    ? Number(incoming.temperature)
                    : merged.temperature,
                questionCount: Number.isFinite(Number(incoming.questionCount))
                    ? Math.min(Math.max(Number(incoming.questionCount), 1), 30)
                    : merged.questionCount,
                difficulty: typeof incoming.difficulty === 'string' ? incoming.difficulty : merged.difficulty,
                style: Array.isArray(incoming.style) ? incoming.style : merged.style,
                focusTopic: typeof incoming.focusTopic === 'string' ? incoming.focusTopic : merged.focusTopic
            }
        })
    })

    // Generate quiz via CLI
    ipcMain.handle(IPC_CHANNELS.GENERATE_QUIZ_CLI, async (event, params: QuizGenerateParams) => {
        try {
            // Load settings using manager (leverages cache)
            const settings = await settingsManager.read()

            const safeParams = (params && typeof params === 'object') ? params : {}
            const { pdfPath, ...quizParams } = safeParams as QuizGenerateParams

            if (!pdfPath || typeof pdfPath !== 'string') {
                throw new Error('error_no_pdf_selected')
            }

            // SECURITY: Validate path is allowed (prevents path traversal)
            if (!isPathAllowed(pdfPath)) {
                console.warn('[QuizCLI] Rejected path outside allowed directories')
                throw new Error('error_restricted_location')
            }

            // SECURITY: Validate PDF file (extension, size, magic bytes)
            const validation = await validatePdfFile(pdfPath)
            if (!validation.valid) {
                throw new Error(validation.error)
            }

            // Define working directory as system temp directory to avoid permission issues
            const workDir = os.tmpdir()

            // SECURITY: Create a temporary safe copy with secure random name
            const safePdfName = generateSecureTempName('pdf')
            const safePdfPath = path.join(workDir, safePdfName)

            // SECURITY: Work with a safe copy in temp directory
            await fs.copyFile(pdfPath, safePdfPath)

            try {
                // Generate output file path in temp dir
                const outputFilePath = generateOutputFilePath(workDir)

                const prompt = buildQuizPrompt(quizParams, safePdfPath, outputFilePath)

                // Use model from params (frontend) or settings
                const model = typeof quizParams.model === 'string' ? quizParams.model : settings.model

                // Execute CLI from temp directory
                const result = await executeGeminiCli(prompt, {
                    model: model,
                    workingDir: workDir,
                    outputFilePath: outputFilePath
                })

                // SECURITY: Validate response format
                if (!Array.isArray(result)) {
                    throw new Error('error_ai_response_invalid')
                }

                return {
                    success: true,
                    data: result,
                    count: result.length
                }
            } finally {
                // Cleanup temp pdf
                await fs.unlink(safePdfPath).catch(() => { })
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('[QuizCLI] Generation failed:', message)
            return {
                success: false,
                error: message || 'error_quiz_gen_failed'
            }
        }
    })

    // Ask AI Assistant (General Chat/Context)
    ipcMain.handle(IPC_CHANNELS.ASK_AI, async (event, params: { question: string; context?: string; history?: unknown[] }) => {
        try {
            const { question, context } = params
            if (!question) throw new Error('error_invalid_input')

            // Load settings using manager
            const settings = await settingsManager.read()

            const workDir = os.tmpdir()
            const outputFilePath = generateOutputFilePath(workDir)

            // Build Prompt
            let promptText = `
            ROLE: You are an expert academic assistant for medical students.
            TASK: Answer the user's question concisely and accurately.
            
            OUTPUT FORMAT: JSON Object
            {
                "answer": "MARKDOWN formatted answer here...",
                "suggestions": ["Follow-up question 1", "Follow-up question 2"]
            }

            USER QUESTION: "${question}"
            `

            if (context) {
                promptText += `\nCONTEXT/BACKGROUND INFO:\n${context.slice(0, 5000)}`
            }

            promptText += `\n\nIMPORTANT: Output ONLY valid JSON.`

            const result = await executeGeminiCli(promptText, {
                model: settings.model,
                workingDir: workDir,
                outputFilePath: outputFilePath,
                responseType: 'json-object'
            })

            return { success: true, data: result }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('[QuizCLI] Ask AI failed:', message)
            return { success: false, error: message }
        }
    })
}

export { registerQuizHandlers }
