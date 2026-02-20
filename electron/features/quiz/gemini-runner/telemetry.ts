import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export async function logTelemetry(event: 'START' | 'SUCCESS' | 'ERROR', model: string, durationMs: number, details?: string) {
    try {
        let logDir = os.tmpdir()
        if (app && app.getPath) {
            try { logDir = path.join(app.getPath('userData'), 'logs') } catch { }
        }

        await fs.mkdir(logDir, { recursive: true }).catch(() => { })

        const date = new Date()
        const dateString = date.toISOString().split('T')[0]
        const logFile = path.join(logDir, `gemini-service-${dateString}.log`)

        const logLine = `[${date.toISOString()}] [${event}] [Model: ${model}] [Duration: ${durationMs.toFixed(2)}ms] ${details ? '| Details: ' + details : ''}\n`
        await fs.appendFile(logFile, logLine, 'utf8').catch(() => { })
    } catch {
        // Telemetry errors should never crash the main application
    }
}
