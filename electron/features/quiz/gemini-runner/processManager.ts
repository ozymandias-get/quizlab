import { ChildProcess } from 'child_process'
import { app } from 'electron'

const activeProcesses = new Set<ChildProcess>()

export function registerProcess(cp: ChildProcess) {
    activeProcesses.add(cp)
}

export function unregisterProcess(cp: ChildProcess) {
    activeProcesses.delete(cp)
}

export function cleanupActiveProcesses() {
    for (const cp of activeProcesses) {
        if (!cp.killed) {
            try { cp.kill('SIGKILL') } catch { }
        }
    }
}

// OS / Node exit
process.on('exit', cleanupActiveProcesses)
process.on('SIGINT', () => { cleanupActiveProcesses(); process.exit(0); })
process.on('SIGTERM', () => { cleanupActiveProcesses(); process.exit(0); })

// Electron exit
if (app && typeof app.on === 'function') {
    app.on('before-quit', cleanupActiveProcesses)
}
