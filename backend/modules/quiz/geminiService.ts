import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { randomBytes } from 'crypto'
import { app } from 'electron'

// Allowed models whitelist
const ALLOWED_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
] as const

type AllowedModel = typeof ALLOWED_MODELS[number]

interface ExecuteGeminiOptions {
    model?: string;
    timeout?: number;
    workingDir?: string | null;
    outputFilePath: string;
    responseType?: 'json-array' | 'json-object' | 'text';
}

type QuizItem = Record<string, unknown>
type AssistantResponse = { answer: string; suggestions?: string[] }
type CliResult = QuizItem[] | AssistantResponse | unknown

function validateModel(model?: string): AllowedModel {
    if (typeof model !== 'string') return ALLOWED_MODELS[0]
    const cleanModel = model.trim().toLowerCase()
    return ALLOWED_MODELS.find(m => m.toLowerCase() === cleanModel) || ALLOWED_MODELS[0]
}

function generateSecureTempPath(prefix: string, extension: string): string {
    const token = randomBytes(16).toString('hex')
    return path.join(os.tmpdir(), `${prefix}_${token}.${extension}`)
}

function getGeminiCliPath(): string {
    const isWindows = process.platform === 'win32'
    const cliName = isWindows ? 'gemini.cmd' : 'gemini'

    if (app.isPackaged) {
        const resourcesPath = path.dirname(app.getAppPath())
        return path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '.bin', cliName)
    }
    return path.join(__dirname, '../../../node_modules/.bin', cliName)
}

async function findGeminiCliPath(): Promise<string | null> {
    const isWindows = process.platform === 'win32'
    const cliName = isWindows ? 'gemini.cmd' : 'gemini'
    const resourcesPath = app.isPackaged ? path.dirname(app.getAppPath()) : null

    const pathsToCheck = app.isPackaged
        ? [
            path.join(resourcesPath!, 'app.asar.unpacked', 'node_modules', '.bin', cliName),
            path.join(resourcesPath!, 'node_modules', '.bin', cliName),
            isWindows ? path.join(process.env.APPDATA || '', 'npm', cliName) : '/usr/local/bin/gemini'
        ]
        : [path.join(__dirname, '../../../node_modules/.bin', cliName)]

    for (const checkPath of pathsToCheck) {
        try {
            const stats = await fs.stat(checkPath)
            if (stats.isFile()) return checkPath
        } catch { continue }
    }
    return null
}

function generateOutputFilePath(workingDir: string): string {
    return path.join(workingDir, `quiz_output_${randomBytes(8).toString('hex')}.json`)
}

async function executeGeminiCli(prompt: string, options: ExecuteGeminiOptions): Promise<CliResult> {
    const { model = 'gemini-2.5-flash', timeout = 300000, workingDir = null, outputFilePath, responseType = 'json-array' } = options
    const cliPath = await findGeminiCliPath()

    if (!cliPath) throw new Error('Gemini CLI not found.')

    const tempPromptFile = generateSecureTempPath('gemini_prompt', 'txt')
    await fs.writeFile(tempPromptFile, prompt, 'utf8')

    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32'
        const command = isWindows
            ? `type "${tempPromptFile}" | "${cliPath}" -m ${validateModel(model)} --yolo`
            : `cat "${tempPromptFile}" | "${cliPath}" -m ${validateModel(model)} --yolo`

        const childProcess = spawn(command, [], {
            shell: true,
            windowsHide: true,
            cwd: workingDir || process.cwd(),
            env: { ...process.env, NODE_ENV: 'production' }
        })

        let stdout = ''
        let stderr = ''
        childProcess.stdout.on('data', d => stdout += d.toString())
        childProcess.stderr.on('data', d => stderr += d.toString())

        let isFulfilled = false

        const cleanup = async () => {
            clearTimeout(timeoutId)
            clearInterval(intervalId)
            await fs.unlink(tempPromptFile).catch(() => { })
            await fs.unlink(outputFilePath).catch(() => { })
        }

        const timeoutId = setTimeout(() => {
            if (isFulfilled) return
            isFulfilled = true
            childProcess.kill()
            cleanup()
            reject(new Error('CLI timeout (5 min)'))
        }, timeout)

        const checkFile = async () => {
            if (isFulfilled) return true
            try {
                const content = await fs.readFile(outputFilePath, 'utf8')
                if (content.length < 5) return false

                const json = content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
                const parsed = JSON.parse(json)

                isFulfilled = true
                childProcess.kill()
                await cleanup()
                resolve(parsed)
                return true
            } catch { return false }
        }

        const intervalId = setInterval(checkFile, 1000)

        childProcess.on('close', async (code) => {
            if (isFulfilled) return

            // Give 500ms for file to be flushed if process just closed
            setTimeout(async () => {
                if (isFulfilled) return
                const foundInFile = await checkFile()
                if (foundInFile) return

                isFulfilled = true
                await cleanup()

                if (code !== 0) {
                    reject(new Error(stderr || `CLI failed with code ${code}`))
                } else {
                    const fallback = parseFromStdout(stdout, responseType)
                    fallback ? resolve(fallback) : reject(new Error('No response received.'))
                }
            }, 500)
        })
    })
}

function parseFromStdout(stdout: string, responseType: string): unknown | null {
    if (!stdout) return null
    try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
        if (!jsonMatch) return null
        const parsed = JSON.parse(jsonMatch[0])
        if (responseType === 'json-array' && !Array.isArray(parsed)) return null
        return parsed
    } catch { return null }
}

export { getGeminiCliPath, findGeminiCliPath, executeGeminiCli, generateOutputFilePath }
