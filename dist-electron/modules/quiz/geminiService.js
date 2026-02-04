"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeminiCliPath = getGeminiCliPath;
exports.findGeminiCliPath = findGeminiCliPath;
exports.executeGeminiCli = executeGeminiCli;
exports.generateOutputFilePath = generateOutputFilePath;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = require("crypto");
const electron_1 = require("electron");
// Allowed models whitelist - prevents command injection via model parameter
const ALLOWED_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
];
/**
 * Validate model against whitelist
 * @param {string} model - Model name to validate
 * @returns {string} - Validated model or default
 */
function validateModel(model) {
    if (typeof model !== 'string') {
        return ALLOWED_MODELS[0];
    }
    const cleanModel = model.trim().toLowerCase();
    const validModel = ALLOWED_MODELS.find(m => m.toLowerCase() === cleanModel);
    return validModel || ALLOWED_MODELS[0];
}
/**
 * Generate cryptographically secure temp file name
 * @param {string} prefix - File name prefix
 * @param {string} extension - File extension
 * @returns {string} - Secure file path
 */
function generateSecureTempPath(prefix, extension) {
    const token = (0, crypto_1.randomBytes)(16).toString('hex');
    const fileName = `${prefix}_${token}.${extension}`;
    return path_1.default.join(os_1.default.tmpdir(), fileName);
}
// Get bundled Gemini CLI path - works in both development and production
function getGeminiCliPath() {
    const isWindows = process.platform === 'win32';
    const cliName = isWindows ? 'gemini.cmd' : 'gemini';
    // Check if running as packaged app
    if (electron_1.app.isPackaged) {
        // In production, node_modules is outside the asar package
        // app.getAppPath() returns path to app.asar, we need to go to the parent
        // Resources structure: resources/app.asar and resources/app.asar.unpacked/node_modules
        // But since we're using regular dependencies (not native), they should be in the asar
        // However, .bin executables need to be accessible from outside
        // Try multiple possible locations for production
        const appPath = electron_1.app.getAppPath();
        const resourcesPath = path_1.default.dirname(appPath);
        // Option 1: Unpacked node_modules (if configured in electron-builder)
        const unpackedPath = path_1.default.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '.bin', cliName);
        // Option 2: System-wide installation (user may have installed globally)
        const globalPath = isWindows
            ? path_1.default.join(process.env.APPDATA || '', 'npm', cliName)
            : '/usr/local/bin/gemini';
        // Option 3: In the app directory structure (fallback)
        const appDirPath = path_1.default.join(resourcesPath, 'node_modules', '.bin', cliName);
        // Return unpacked path as primary (we'll configure electron-builder to unpack it)
        return unpackedPath;
    }
    else {
        // Development mode - use local node_modules
        const devPath = path_1.default.join(__dirname, '../../../node_modules/.bin', cliName);
        return devPath;
    }
}
/**
 * Find the actual CLI path by checking multiple locations
 * @returns {Promise<string|null>} - Path to CLI if found, null otherwise
 */
async function findGeminiCliPath() {
    const isWindows = process.platform === 'win32';
    const cliName = isWindows ? 'gemini.cmd' : 'gemini';
    const pathsToCheck = [];
    if (electron_1.app.isPackaged) {
        const appPath = electron_1.app.getAppPath();
        const resourcesPath = path_1.default.dirname(appPath);
        // Priority order for production
        pathsToCheck.push(path_1.default.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '.bin', cliName), path_1.default.join(resourcesPath, 'node_modules', '.bin', cliName), isWindows
            ? path_1.default.join(process.env.APPDATA || '', 'npm', cliName)
            : '/usr/local/bin/gemini');
    }
    else {
        // Development
        pathsToCheck.push(path_1.default.join(__dirname, '../../../node_modules/.bin', cliName));
    }
    // Check each path
    for (const checkPath of pathsToCheck) {
        try {
            await fs_1.promises.access(checkPath);
            return checkPath;
        }
        catch {
            continue;
        }
    }
    return null;
}
/**
 * Generate a unique output file path for quiz results
 * @param {string} workingDir - Directory where the file will be created
 * @returns {string} - Full path to the output file
 */
function generateOutputFilePath(workingDir) {
    const token = (0, crypto_1.randomBytes)(8).toString('hex');
    const fileName = `quiz_output_${token}.json`;
    return path_1.default.join(workingDir, fileName);
}
/**
 * Execute Gemini CLI with prompt
 * CLI will write the result to a JSON file instead of stdout
 * @param {string} prompt - The prompt to send (should include file output instruction)
 * @param {Object} options - CLI options
 * @param {string} options.outputFilePath - Path where CLI should write the JSON output
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function executeGeminiCli(prompt, options) {
    const { model = 'gemini-2.5-flash', timeout = 300000, workingDir = null, outputFilePath, responseType = 'json-array' } = options;
    const safeTimeout = Number.isFinite(timeout) ? timeout : 300000;
    // SECURITY: Validate model against whitelist
    const validatedModel = validateModel(model);
    // Find CLI path (checks multiple locations for production compatibility)
    const cliPath = await findGeminiCliPath();
    if (!cliPath) {
        throw new Error('Gemini CLI bulunamadı. Lütfen global olarak yükleyin: npm install -g @google/gemini-cli');
    }
    // SECURITY: Use cryptographically secure temp file name
    const tempPromptFile = generateSecureTempPath('gemini_prompt', 'txt');
    await fs_1.promises.writeFile(tempPromptFile, prompt, 'utf8');
    return new Promise((resolve, reject) => {
        // Build command arguments - SECURITY: Use spawn with args array instead of shell string
        const isWindows = process.platform === 'win32';
        let command;
        if (isWindows) {
            // Use type to pipe file content to CLI
            // SECURITY: Model is validated, paths are quoted
            command = `type "${tempPromptFile}" | "${cliPath}" -m ${validatedModel} --yolo`;
        }
        else {
            command = `cat "${tempPromptFile}" | "${cliPath}" -m ${validatedModel} --yolo`;
        }
        const childProcess = (0, child_process_1.spawn)(command, [], {
            shell: true,
            windowsHide: true,
            cwd: workingDir || process.cwd(),
            env: { ...process.env, NODE_ENV: 'production' } // Don't leak dev env vars
        });
        let stdout = '';
        let stderr = '';
        childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            // Keep limited output for diagnostics if needed in the future
        });
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.warn('[QuizCLI] stderr:', data.toString().slice(0, 200));
        });
        // Timeout handler - but will be cancelled if file is detected
        let timeoutCancelled = false;
        const timeoutId = setTimeout(async () => {
            if (timeoutCancelled)
                return;
            childProcess.kill('SIGTERM');
            await fs_1.promises.unlink(tempPromptFile).catch(() => { });
            reject(new Error('CLI zaman aşımına uğradı (5 dakika)'));
        }, safeTimeout);
        // File watcher - check if output file is created and complete
        // Uses JSON parse validation and file size stability to avoid race conditions
        let lastFileSize = 0;
        let stableSizeCount = 0;
        const STABLE_THRESHOLD = 2; // File size must be stable for 2 consecutive checks
        const fileCheckInterval = setInterval(async () => {
            try {
                // Check if file exists
                await fs_1.promises.access(outputFilePath);
                // Get file stats to check size stability
                const stats = await fs_1.promises.stat(outputFilePath);
                const currentSize = stats.size;
                // Check if file size is stable (not still being written)
                if (currentSize === lastFileSize && currentSize > 0) {
                    stableSizeCount++;
                }
                else {
                    stableSizeCount = 0;
                    lastFileSize = currentSize;
                    return; // File is still being written, wait for next check
                }
                // Only proceed if file size has been stable
                if (stableSizeCount < STABLE_THRESHOLD)
                    return;
                // Read content to check completion
                const fileContent = await fs_1.promises.readFile(outputFilePath, 'utf8');
                const trimmed = fileContent.trim();
                // Must have minimum content length
                if (trimmed.length < 5)
                    return;
                // Try to validate by parsing
                let isValid = false;
                try {
                    // Clean potential markdown wrapper before parsing
                    let jsonContent = trimmed
                        .replace(/^\uFEFF/, '') // Remove BOM
                        .replace(/^```json\s*/i, '')
                        .replace(/```\s*$/, '')
                        .trim();
                    const parsed = JSON.parse(jsonContent);
                    if (responseType === 'json-array') {
                        // Verify it's an array with at least one item
                        isValid = Array.isArray(parsed) && parsed.length > 0;
                    }
                    else if (responseType === 'json-object') {
                        // Verify it is an object
                        isValid = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
                    }
                    else {
                        isValid = true;
                    }
                }
                catch {
                    // Parse failed - file is incomplete or invalid
                    isValid = false;
                }
                if (isValid && !timeoutCancelled) {
                    try {
                        const fileContent = await fs_1.promises.readFile(outputFilePath, 'utf8');
                        // Clean potential markdown wrapper before parsing (redundant but safe)
                        let jsonContent = fileContent.trim()
                            .replace(/^\uFEFF/, '')
                            .replace(/^```json\s*/i, '')
                            .replace(/```\s*$/, '')
                            .trim();
                        const finalParsed = JSON.parse(jsonContent);
                        // Set flag to prevent 'close' handler from double-resolving or rejecting
                        timeoutCancelled = true;
                        // Clear timers
                        clearTimeout(timeoutId);
                        clearInterval(fileCheckInterval);
                        // Cleanup file
                        await fs_1.promises.unlink(outputFilePath).catch(() => { });
                        resolve(finalParsed);
                        // Kill process to stop CLI
                        childProcess.kill();
                    }
                    catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        console.error('[QuizCLI] Error during early resolve:', message);
                        timeoutCancelled = false;
                    }
                }
            }
            catch {
                // File not found or not readable yet
                stableSizeCount = 0;
            }
        }, 1500); // Check every 1.5 seconds for faster response
        childProcess.on('close', async (code) => {
            clearTimeout(timeoutId);
            clearInterval(fileCheckInterval);
            await fs_1.promises.unlink(tempPromptFile).catch(() => { });
            if (timeoutCancelled)
                return;
            try {
                // Wait a bit for file system sync
                await new Promise(r => setTimeout(r, 100));
                // Check if output file exists
                await fs_1.promises.access(outputFilePath);
                // Read and parse output
                const fileContent = await fs_1.promises.readFile(outputFilePath, 'utf8');
                await fs_1.promises.unlink(outputFilePath).catch(() => { });
                const trimmedContent = fileContent.trim();
                let jsonContent = trimmedContent
                    .replace(/^\uFEFF/, '')
                    .replace(/^```json\s*/i, '')
                    .replace(/```\s*$/, '')
                    .trim();
                const parsed = JSON.parse(jsonContent);
                resolve(parsed);
            }
            catch (fileError) {
                try {
                    const result = parseFromStdout(stdout, responseType);
                    if (result) {
                        resolve(result);
                        return;
                    }
                }
                catch { }
                if (code !== 0 && stderr) {
                    reject(new Error(stderr.slice(0, 500) || `CLI hata kodu: ${code}`));
                }
                else {
                    reject(new Error('Yapay zeka yanıtı alınamadı.'));
                }
            }
        });
        childProcess.on('error', async (err) => {
            clearTimeout(timeoutId);
            clearInterval(fileCheckInterval);
            await fs_1.promises.unlink(tempPromptFile).catch(() => { });
            console.error('[QuizCLI] Spawn error:', err);
            reject(new Error(`CLI başlatılamadı: ${err.message}`));
        });
    });
}
/**
 * Fallback: Try to parse JSON from stdout
 */
function parseFromStdout(stdout, responseType) {
    if (!stdout || stdout.length < 5)
        return null;
    // Try to extract from "response" field (Gemini CLI wrapper format)
    const responseFieldMatch = stdout.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    let contentToParse = stdout;
    if (responseFieldMatch && responseFieldMatch[1]) {
        // Unescape the JSON string
        contentToParse = responseFieldMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\');
    }
    // Remove markdown code blocks
    contentToParse = contentToParse.replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^[^{[]*/, '') // Remove prefix text
        .replace(/[^}\]]*$/, '') // Remove suffix text
        .trim();
    try {
        const parsed = JSON.parse(contentToParse);
        if (responseType === 'json-array') {
            if (Array.isArray(parsed) && parsed.length > 0)
                return parsed;
        }
        else if (responseType === 'json-object') {
            if (typeof parsed === 'object' && !Array.isArray(parsed))
                return parsed;
        }
        else {
            return parsed;
        }
    }
    catch {
        return null;
    }
    return null;
}
