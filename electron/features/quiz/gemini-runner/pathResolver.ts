import { app } from 'electron'
import path from 'path'
import { promises as fs } from 'fs'

export function getGeminiCliPath(): string {
    const isWindows = process.platform === 'win32'
    const cliName = isWindows ? 'gemini.cmd' : 'gemini'

    if (app && app.isPackaged) {
        const resourcesPath = path.dirname(app.getAppPath())
        return path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '.bin', cliName)
    }
    return path.join(process.cwd(), 'node_modules/.bin', cliName)
}

export async function findGeminiCliPath(): Promise<string | null> {
    const isWindows = process.platform === 'win32'
    const cliName = isWindows ? 'gemini.cmd' : 'gemini'
    const resourcesPath = (app && app.isPackaged) ? path.dirname(app.getAppPath()) : null

    const pathsToCheck = [
        ...((app && app.isPackaged) ? [
            path.join(resourcesPath!, 'app.asar.unpacked', 'node_modules', '.bin', cliName),
            path.join(resourcesPath!, 'node_modules', '.bin', cliName)
        ] : []),
        path.join(process.cwd(), 'node_modules', '.bin', cliName),
        // Global npm paths
        isWindows ? path.join(process.env.APPDATA || '', 'npm', cliName) : '/usr/local/bin/gemini',
        isWindows ? path.join(process.env.ProgramFiles || '', 'nodejs', cliName) : '/usr/bin/gemini',
        !isWindows ? path.join(process.env.HOME || '', '.npm-global', 'bin', 'gemini') : '',
        !isWindows && process.env.NODE_VERSION ? path.join(process.env.HOME || '', '.nvm', 'versions', 'node', process.env.NODE_VERSION, 'bin', 'gemini') : ''
    ].filter(Boolean)

    for (const checkPath of pathsToCheck) {
        try {
            const stats = await fs.stat(checkPath)
            if (stats.isFile()) return checkPath
        } catch { continue }
    }

    try {
        const { execSync } = require('child_process');
        const cmd = isWindows ? 'where gemini' : 'which gemini';
        const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const paths = result.trim().split(/\r?\n/);
        if (paths.length > 0 && paths[0]) {
            return paths[0].trim();
        }
    } catch {
        // Not found in PATH
    }

    return null
}
