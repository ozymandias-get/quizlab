import { spawn } from 'child_process'
import path from 'path'
import { randomBytes } from 'crypto'
import { ALLOWED_MODELS, ExecuteGeminiOptions, CliResult, MAX_PAYLOAD_SIZE, MAX_BUFFER_SIZE, AllowedModel } from './types'
import { findGeminiCliPath } from './pathResolver'
import { logTelemetry } from './telemetry'
import { parseFromStdout } from './parser'
import { registerProcess, unregisterProcess } from './processManager'
import { TaskQueue } from './taskQueue'

// Limits queue to 2 parallel tasks
const geminiTaskQueue = new TaskQueue(2);

function validateModel(model?: string): AllowedModel {
    if (typeof model !== 'string') return ALLOWED_MODELS[0]
    const cleanModel = model.trim().toLowerCase()
    return ALLOWED_MODELS.find(m => m.toLowerCase() === cleanModel) || ALLOWED_MODELS[0]
}

export function generateOutputFilePath(workingDir: string): string {
    return path.join(workingDir, `quiz_output_${randomBytes(8).toString('hex')}.json`)
}

export async function executeGeminiCli(prompt: string, options: ExecuteGeminiOptions): Promise<CliResult> {
    // Basic IPC Sandbox & Firewall Validation
    if (typeof prompt !== 'string') {
        throw new Error('ValidationError: Prompt must be a string.');
    }
    if (prompt.length > MAX_PAYLOAD_SIZE) {
        throw new Error(`ValidationError: Prompt is too large (max ${MAX_PAYLOAD_SIZE} chars). Current: ${prompt.length}`);
    }

    return geminiTaskQueue.enqueue(() => _executeWithRetry(prompt, options));
}

async function _executeWithRetry(prompt: string, options: ExecuteGeminiOptions, maxRetries = 3): Promise<CliResult> {
    let attempt = 0;

    while (true) {
        attempt++;
        const startTime = performance.now();
        const model = validateModel(options.model);

        await logTelemetry('START', model, 0, `Attempt ${attempt}/${maxRetries}`);

        try {
            const result = await _executeGeminiCliInternal(prompt, options);

            const duration = performance.now() - startTime;
            await logTelemetry('SUCCESS', model, duration, `Attempt ${attempt}`);

            return result;
        } catch (error: any) {
            const duration = performance.now() - startTime;
            const errMsg = error?.message || 'Unknown error';

            await logTelemetry('ERROR', model, duration, `Attempt ${attempt} | Error: ${errMsg}`);

            // Don't retry these hard faults
            if (
                errMsg.includes('AbortError') ||
                errMsg.includes('ValidationError') ||
                errMsg.includes('Circuit Breaker')
            ) {
                throw error;
            }

            if (attempt >= maxRetries) {
                throw new Error(`Failed after ${maxRetries} attempts. Last error: ${errMsg}`);
            }

            const backoffTime = Math.pow(2, attempt) * 1000;

            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, backoffTime);
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        reject(new Error('AbortError: The operation was aborted during backoff.'));
                    }, { once: true });
                }
            });
        }
    }
}

async function _executeGeminiCliInternal(prompt: string, options: ExecuteGeminiOptions): Promise<CliResult> {
    const { model = 'gemini-2.5-flash', timeout = 300000, workingDir = null, responseType = 'json-array', signal } = options
    const cliPath = await findGeminiCliPath()

    if (!cliPath) throw new Error('Gemini CLI not found.')

    if (signal?.aborted) {
        throw new Error('AbortError: The operation was aborted.');
    }

    return new Promise((resolve, reject) => {
        // -p 'Prompt:' is used to trigger headless mode without the string being swallowed by Windows CMD
        const childProcess = spawn(cliPath, ['-m', validateModel(model), '-p', 'Prompt:', '-o', 'json'], {
            shell: process.platform === 'win32',
            windowsHide: true,
            cwd: workingDir || process.cwd(),
            env: {
                ...process.env,
                NODE_ENV: 'production',
                CI: 'true',
                NO_COLOR: '1',
                FORCE_COLOR: '0',
                NO_UPDATE_NOTIFIER: '1',
                GEMINI_SKIP_SETUP: 'true',
                NODE_OPTIONS: '--no-deprecation'
            }
        })

        registerProcess(childProcess);
        let isDone = false

        let stdout = ''
        let stderr = ''

        const cleanup = () => {
            if (isDone) return;
            isDone = true;
            unregisterProcess(childProcess);
            clearTimeout(timeoutId);
            if (signal) {
                signal.removeEventListener('abort', handleAbort);
            }
            // Mükemmeliyet (Perfection): Bellek sızıntılarını önlemek için tüm dinleyicileri (listeners) temizle
            childProcess.stdout?.removeAllListeners();
            childProcess.stderr?.removeAllListeners();
            childProcess.removeAllListeners();
        };

        const handleAbort = () => {
            if (isDone) return;
            try { childProcess.kill('SIGKILL'); } catch { }
            cleanup();
            reject(new Error('AbortError: The operation was aborted.'));
        };

        if (signal) {
            signal.addEventListener('abort', handleAbort);
        }

        childProcess.stdout.setEncoding('utf8')
        childProcess.stderr.setEncoding('utf8')

        childProcess.stdout.on('data', d => {
            stdout += d
            if (stdout.length > MAX_BUFFER_SIZE) {
                try { childProcess.kill('SIGKILL'); } catch { }
                cleanup();
                reject(new Error('Circuit Breaker: Memory overflow prevented (stdout exceeded 10MB).'))
            }
        })

        childProcess.stderr.on('data', d => {
            stderr += d
            if (stderr.length > MAX_BUFFER_SIZE) {
                try { childProcess.kill('SIGKILL'); } catch { }
                cleanup();
                reject(new Error('Circuit Breaker: Memory overflow prevented (stderr exceeded 10MB).'))
            }
        })

        const timeoutId = setTimeout(() => {
            try { childProcess.kill('SIGKILL'); } catch { }
            cleanup();
            reject(new Error('Network/CLI timeout (5 min)'))
        }, timeout)

        childProcess.on('close', (code) => {
            cleanup();

            if (code !== 0 && code !== null) {
                return reject(new Error(stderr || `CLI failed with code ${code}`))
            }

            const parsed = parseFromStdout(stdout, responseType)
            if (parsed) {
                resolve(parsed)
            } else {
                reject(new Error('Syntax Error: No valid response received or parsing failed.'))
            }
        })

        childProcess.on('error', (err) => {
            if (isDone) return;
            cleanup();
            reject(err);
        });

        // Beklenmedik kapanmalarda Stdin'in çökmeye (EPIPE) neden olmasını engelle
        childProcess.stdin.on('error', (err: any) => {
            if (err.code === 'EPIPE') {
                // CLI kapandığında (veya çöktüğünde) verinin geri kalanı yazılamaz, görmezden gelinebilir (Close olayı zaten hatayı yakalar)
            } else if (!isDone) {
                cleanup();
                reject(err);
            }
        });

        childProcess.stdin.write(prompt, 'utf8');
        childProcess.stdin.end();
    })
}
