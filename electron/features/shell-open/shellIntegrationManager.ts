import { execFile } from 'child_process'
import { app } from 'electron'
import { promisify } from 'util'

import { Logger } from '../../core/logger.js'

const execFileAsync = promisify(execFile)

// Per-user Explorer context-menu konumu. HKCU kullanıldığı için UAC
// gerekmez ve varsayılan PDF handler'ına dokunulmaz — sadece sağ tıkta
// ek bir "QuizLab ile Aç" girdisi çıkar.
const SHELL_KEY = 'HKCU\\Software\\Classes\\SystemFileAssociations\\.pdf\\shell\\QuizlabReader'
const SHELL_COMMAND_KEY = `${SHELL_KEY}\\command`

export interface ShellIntegrationStatus {
  supported: boolean
  installed: boolean
  label: string | null
  exePath: string | null
}

export function getShellMenuLabel(locale?: string): string {
  const lang = (locale || app.getLocale()).toLowerCase()
  return lang.startsWith('tr') ? 'QuizLab ile Aç' : 'Open with QuizLab'
}

function currentExePath(): string {
  try {
    return app.getPath('exe')
  } catch {
    return process.execPath
  }
}

async function reg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('reg', args, { windowsHide: true })
}

export async function getShellIntegrationStatus(): Promise<ShellIntegrationStatus> {
  if (process.platform !== 'win32') {
    return { supported: false, installed: false, label: null, exePath: null }
  }
  try {
    const { stdout } = await reg(['query', SHELL_COMMAND_KEY, '/ve'])
    const installed = stdout.includes('(Default)') || stdout.includes('REG_SZ')
    const labelOut = await reg(['query', SHELL_KEY, '/ve']).catch(() => ({
      stdout: '',
      stderr: ''
    }))
    const labelMatch = /REG_SZ\s+(.+)/.exec(labelOut.stdout)
    return {
      supported: true,
      installed,
      label: labelMatch ? labelMatch[1].trim() : null,
      exePath: currentExePath()
    }
  } catch {
    return { supported: true, installed: false, label: null, exePath: currentExePath() }
  }
}

export async function installShellIntegration(
  label?: string
): Promise<{ success: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { success: false, error: 'unsupported_platform' }
  }
  const exePath = currentExePath()
  const menuLabel = label || getShellMenuLabel()
  const command = `"${exePath}" "%1"`
  try {
    await reg(['add', SHELL_KEY, '/ve', '/d', menuLabel, '/f'])
    await reg(['add', SHELL_KEY, '/v', 'Icon', '/d', `${exePath},0`, '/f'])
    await reg(['add', SHELL_COMMAND_KEY, '/ve', '/d', command, '/f'])
    return { success: true }
  } catch (error) {
    Logger.error('[ShellIntegration] Install failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function removeShellIntegration(): Promise<{ success: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { success: false, error: 'unsupported_platform' }
  }
  try {
    await reg(['delete', SHELL_KEY, '/f'])
    return { success: true }
  } catch (error) {
    // Zaten yoksa başarı sayılır.
    const message = error instanceof Error ? error.message : String(error)
    if (/unable to find|bulunamadı/i.test(message)) return { success: true }
    Logger.error('[ShellIntegration] Remove failed:', error)
    return { success: false, error: message }
  }
}
