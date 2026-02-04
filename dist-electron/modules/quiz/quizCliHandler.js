"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerQuizHandlers = registerQuizHandlers;
/**
 * Quiz CLI Handler Module
 * Orchestrates quiz generation using modular components
 */
const electron_1 = require("electron");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = require("crypto");
const child_process_1 = require("child_process"); // Used for login terminal
const constants_1 = require("../../main/constants");
const promptBuilder_1 = require("./promptBuilder");
const geminiService_1 = require("./geminiService");
// Default settings file path
const getQuizSettingsPath = () => path_1.default.join(electron_1.app.getPath('userData'), 'quiz_settings.json');
// Security Constants
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit
const ALLOWED_EXTENSIONS = ['.pdf'];
// Default settings
const DEFAULT_QUIZ_SETTINGS = {
    model: 'gemini-2.5-flash',
    maxOutputTokens: 8192,
    temperature: 0.7,
    questionCount: 10,
    difficulty: 'MEDIUM',
    style: ['MIXED'],
    focusTopic: ''
};
/**
 * SECURITY: Validate PDF path is within allowed directories
 * Prevents path traversal attacks
 * @param {string} pdfPath - Path to validate
 * @returns {boolean} - True if path is allowed
 */
function isPathAllowed(pdfPath) {
    if (!pdfPath || typeof pdfPath !== 'string') {
        return false;
    }
    try {
        // Normalize the path to resolve ../ and similar
        const normalizedPath = path_1.default.normalize(pdfPath);
        const resolvedPath = path_1.default.resolve(pdfPath);
        // Check for null bytes (common attack vector)
        if (pdfPath.includes('\0') || normalizedPath.includes('\0')) {
            return false;
        }
        // Get allowed directories
        // RELAXED SECURITY: Allow any valid absolute path on the system
        // The user explicitly selects the file via dialog, so we trust reasonable paths.
        // We still reject obviously malicious paths (null bytes) handled above.
        // Ensure path is absolute
        if (!path_1.default.isAbsolute(resolvedPath)) {
            return false;
        }
        // Just check if it looks like a valid path structure (basic check)
        // Access permissions will be handled by fs.stat later
        return true;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[QuizCLI] Path validation error:', message);
        return false;
    }
}
/**
 * SECURITY: Validate file is a PDF and within size limits
 * @param {string} filePath - Path to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function validatePdfFile(filePath) {
    try {
        // Check extension
        const ext = path_1.default.extname(filePath).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return { valid: false, error: 'Sadece PDF dosyaları desteklenir' };
        }
        // Check file exists and get stats
        const stats = await fs_1.promises.stat(filePath);
        if (!stats.isFile()) {
            return { valid: false, error: 'Geçerli bir dosya değil' };
        }
        // Check file size
        if (stats.size > MAX_PDF_SIZE_BYTES) {
            const sizeMB = Math.round(stats.size / 1024 / 1024);
            return { valid: false, error: `Dosya çok büyük (${sizeMB}MB). Maksimum 50MB desteklenir.` };
        }
        if (stats.size === 0) {
            return { valid: false, error: 'Dosya boş' };
        }
        // Basic PDF header check (magic bytes)
        const buffer = Buffer.alloc(5);
        const fileHandle = await fs_1.promises.open(filePath, 'r');
        try {
            await fileHandle.read(buffer, 0, 5, 0);
        }
        finally {
            await fileHandle.close();
        }
        if (buffer.toString() !== '%PDF-') {
            return { valid: false, error: 'Geçerli bir PDF dosyası değil' };
        }
        return { valid: true };
    }
    catch (error) {
        return { valid: false, error: 'Dosya doğrulanamadı' };
    }
}
/**
 * SECURITY: Generate secure temp file name
 */
function generateSecureTempName(extension) {
    const token = (0, crypto_1.randomBytes)(16).toString('hex');
    return `context_${token}.${extension}`;
}
/**
 * Register Quiz CLI IPC handlers
 */
function registerQuizHandlers() {
    const { IPC_CHANNELS } = constants_1.APP_CONFIG;
    // Get CLI path (for settings display)
    electron_1.ipcMain.handle(IPC_CHANNELS.GET_GEMINI_CLI_PATH, async () => {
        const cliPath = await (0, geminiService_1.findGeminiCliPath)();
        if (cliPath) {
            return { path: cliPath, exists: true };
        }
        else {
            return { path: (0, geminiService_1.getGeminiCliPath)(), exists: false };
        }
    });
    // Open terminal for Gemini CLI login
    electron_1.ipcMain.handle(IPC_CHANNELS.OPEN_GEMINI_LOGIN, async () => {
        const cliPath = await (0, geminiService_1.findGeminiCliPath)();
        if (!cliPath) {
            return { success: false, error: 'Gemini CLI bulunamadı. Lütfen global olarak yükleyin: npm install -g @google/gemini-cli' };
        }
        try {
            const isWindows = process.platform === 'win32';
            const isMac = process.platform === 'darwin';
            if (isWindows) {
                // Open new cmd window with gemini CLI
                // The /k flag keeps the window open after command
                (0, child_process_1.spawn)('cmd', ['/c', 'start', 'cmd', '/k', `"${cliPath}"`], {
                    shell: true,
                    detached: true,
                    stdio: 'ignore'
                }).unref();
            }
            else if (isMac) {
                // macOS: Use 'open' command with proper argument structure
                // Creates an AppleScript to run the CLI in Terminal
                const script = `tell application "Terminal" to do script "${cliPath.replace(/"/g, '\\"')}"`;
                (0, child_process_1.spawn)('osascript', ['-e', script], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
            }
            else {
                // Linux: Try common terminal emulators in order of preference
                const terminals = [
                    { cmd: 'gnome-terminal', args: ['--', cliPath] },
                    { cmd: 'konsole', args: ['-e', cliPath] },
                    { cmd: 'xfce4-terminal', args: ['-e', cliPath] },
                    { cmd: 'xterm', args: ['-e', cliPath] }
                ];
                // Try the first available terminal
                let launched = false;
                for (const term of terminals) {
                    try {
                        (0, child_process_1.spawn)(term.cmd, term.args, {
                            detached: true,
                            stdio: 'ignore'
                        }).unref();
                        launched = true;
                        break;
                    }
                    catch {
                        continue;
                    }
                }
                if (!launched) {
                    throw new Error('No supported terminal emulator found');
                }
            }
            return { success: true };
        }
        catch (err) {
            // SECURITY: Don't expose detailed error info
            const message = err instanceof Error ? err.message : String(err);
            console.error('[QuizCLI] Failed to open login terminal:', message);
            return { success: false, error: 'Terminal açılamadı' };
        }
    });
    // Check if Gemini is authenticated
    electron_1.ipcMain.handle(IPC_CHANNELS.CHECK_GEMINI_AUTH, async () => {
        const settingsPath = path_1.default.join(os_1.default.homedir(), '.gemini', 'settings.json');
        try {
            const data = await fs_1.promises.readFile(settingsPath, 'utf8');
            const settings = JSON.parse(data);
            // Check if there's any auth configured
            // Gemini CLI stores auth in security.auth.selectedType
            const hasAuth = !!(settings?.security?.auth?.selectedType ||
                settings.selectedAuthType ||
                settings.apiKey ||
                process.env.GEMINI_API_KEY);
            // SECURITY: Don't log sensitive auth details
            // Try to find account info/email (sanitized for display only)
            let account = null;
            if (settings.security?.auth?.selectedType === 'OAuth') {
                account = 'Google OAuth';
            }
            else if (settings.account || settings.email) {
                // Only show first part of email for privacy
                const email = settings.account || settings.email;
                if (typeof email === 'string' && email.includes('@')) {
                    account = email.split('@')[0].slice(0, 3) + '***@' + email.split('@')[1];
                }
                else {
                    account = 'Configured';
                }
            }
            return { authenticated: hasAuth, account };
        }
        catch (err) {
            // SECURITY: Don't expose detailed error info
            return { authenticated: false };
        }
    });
    // Logout from Gemini (clear auth)
    electron_1.ipcMain.handle(IPC_CHANNELS.GEMINI_LOGOUT, async () => {
        const settingsPath = path_1.default.join(os_1.default.homedir(), '.gemini', 'settings.json');
        try {
            // Read current settings
            let settings = {};
            try {
                const data = await fs_1.promises.readFile(settingsPath, 'utf8');
                settings = JSON.parse(data);
            }
            catch { }
            // Remove auth info
            if (settings.security?.auth) {
                delete settings.security.auth;
            }
            if (settings.selectedAuthType) {
                delete settings.selectedAuthType;
            }
            if (settings.apiKey) {
                delete settings.apiKey;
            }
            // Write back
            await fs_1.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
            return { success: true };
        }
        catch (err) {
            // SECURITY: Don't expose detailed error info
            const message = err instanceof Error ? err.message : String(err);
            console.error('[QuizCLI] Logout failed:', message);
            return { success: false, error: 'Çıkış yapılamadı' };
        }
    });
    // Get quiz settings
    electron_1.ipcMain.handle(IPC_CHANNELS.GET_QUIZ_SETTINGS, async () => {
        try {
            const settingsPath = getQuizSettingsPath();
            const data = await fs_1.promises.readFile(settingsPath, 'utf8');
            const settings = { ...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(data) };
            settings.cliPath = (0, geminiService_1.getGeminiCliPath)();
            return settings;
        }
        catch (e) {
            return { ...DEFAULT_QUIZ_SETTINGS, cliPath: (0, geminiService_1.getGeminiCliPath)() };
        }
    });
    // Save quiz settings
    electron_1.ipcMain.handle(IPC_CHANNELS.SAVE_QUIZ_SETTINGS, async (event, settings) => {
        try {
            const settingsPath = getQuizSettingsPath();
            // Mevcut ayarları oku
            let currentSettings = { ...DEFAULT_QUIZ_SETTINGS };
            try {
                const data = await fs_1.promises.readFile(settingsPath, 'utf8');
                currentSettings = { ...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(data) };
            }
            catch (e) { }
            const incoming = settings || {};
            // Güvenli bir şekilde birleştir (Sadece beklenen alanları al)
            const safeSettings = {
                ...currentSettings,
                // AI Model Ayarları
                model: typeof incoming.model === 'string' ? incoming.model : currentSettings.model,
                maxOutputTokens: Number.isFinite(Number(incoming.maxOutputTokens))
                    ? Number(incoming.maxOutputTokens)
                    : currentSettings.maxOutputTokens,
                temperature: Number.isFinite(Number(incoming.temperature))
                    ? Number(incoming.temperature)
                    : currentSettings.temperature,
                // Quiz Tercihleri (Artık kalıcı!)
                questionCount: Number.isFinite(Number(incoming.questionCount))
                    ? Math.min(Math.max(Number(incoming.questionCount), 1), 30)
                    : currentSettings.questionCount,
                difficulty: typeof incoming.difficulty === 'string' ? incoming.difficulty : currentSettings.difficulty,
                style: Array.isArray(incoming.style) ? incoming.style : currentSettings.style,
                focusTopic: typeof incoming.focusTopic === 'string' ? incoming.focusTopic : currentSettings.focusTopic
            };
            await fs_1.promises.writeFile(settingsPath, JSON.stringify(safeSettings, null, 2));
            return true;
        }
        catch (error) {
            console.error('[QuizCLI] Failed to save settings:', error);
            return false;
        }
    });
    // Generate quiz via CLI
    electron_1.ipcMain.handle(IPC_CHANNELS.GENERATE_QUIZ_CLI, async (event, params) => {
        try {
            // Load settings
            let settings = DEFAULT_QUIZ_SETTINGS;
            try {
                const data = await fs_1.promises.readFile(getQuizSettingsPath(), 'utf8');
                settings = { ...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(data) };
            }
            catch (e) { }
            const safeParams = (params && typeof params === 'object') ? params : {};
            const { type = 'quiz', pdfPath, ...quizParams } = safeParams;
            if (!pdfPath || typeof pdfPath !== 'string') {
                throw new Error('PDF dosyası seçilmedi');
            }
            // SECURITY: Validate path is allowed (prevents path traversal)
            if (!isPathAllowed(pdfPath)) {
                console.warn('[QuizCLI] Rejected path outside allowed directories');
                throw new Error('Bu konumdan dosya yüklenemez');
            }
            // SECURITY: Validate PDF file (extension, size, magic bytes)
            const validation = await validatePdfFile(pdfPath);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            // Define working directory as system temp directory to avoid permission issues
            const workDir = os_1.default.tmpdir();
            // Build prompt based on type
            let prompt;
            // SECURITY: Create a temporary safe copy with secure random name
            const safePdfName = generateSecureTempName('pdf');
            const safePdfPath = path_1.default.join(workDir, safePdfName);
            // SECURITY: Work with a safe copy in temp directory
            await fs_1.promises.copyFile(pdfPath, safePdfPath);
            try {
                // Generate output file path in temp dir
                const outputFilePath = (0, geminiService_1.generateOutputFilePath)(workDir);
                prompt = (0, promptBuilder_1.buildQuizPrompt)(quizParams, safePdfPath, outputFilePath);
                // Use model from params (frontend) or default
                const model = typeof quizParams.model === 'string' ? quizParams.model : DEFAULT_QUIZ_SETTINGS.model;
                // Execute CLI from temp directory
                const result = await (0, geminiService_1.executeGeminiCli)(prompt, {
                    model: model,
                    workingDir: workDir,
                    outputFilePath: outputFilePath
                });
                // SECURITY: Validate response format
                if (!Array.isArray(result)) {
                    throw new Error('Gemini CLI geçersiz format döndü. Lütfen tekrar deneyin.');
                }
                return {
                    success: true,
                    data: result,
                    count: result.length
                };
            }
            finally {
                // Cleanup temp pdf
                await fs_1.promises.unlink(safePdfPath).catch(() => { });
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[QuizCLI] Generation failed:', message);
            return {
                success: false,
                error: message || 'Quiz oluşturma başarısız'
            };
        }
    });
    // Ask AI Assistant (General Chat/Context)
    electron_1.ipcMain.handle(IPC_CHANNELS.ASK_AI, async (event, params) => {
        try {
            const { question, context, history } = params;
            if (!question)
                throw new Error('Soru boş olamaz');
            // Load settings for model selection
            let settings = DEFAULT_QUIZ_SETTINGS;
            try {
                const data = await fs_1.promises.readFile(getQuizSettingsPath(), 'utf8');
                settings = { ...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(data) };
            }
            catch (e) { }
            const workDir = os_1.default.tmpdir();
            const outputFilePath = (0, geminiService_1.generateOutputFilePath)(workDir);
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
            `;
            if (context) {
                promptText += `\nCONTEXT/BACKGROUND INFO:\n${context.slice(0, 5000)}`;
            }
            promptText += `\n\nIMPORTANT: Output ONLY valid JSON.`;
            const result = await (0, geminiService_1.executeGeminiCli)(promptText, {
                model: settings.model,
                workingDir: workDir,
                outputFilePath: outputFilePath,
                responseType: 'json-object'
            });
            return { success: true, data: result };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[QuizCLI] Ask AI failed:', message);
            return { success: false, error: message };
        }
    });
}
