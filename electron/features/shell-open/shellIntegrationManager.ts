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

// v6.0.4'e kadar kaydedilen IExplorerCommand COM eklentisinin CLSID'i.
// Artık derlenmiyor/kaydedilmiyor; eski kurulumlarda ölü bir kayıt
// bırakmamak için remove sırasında temizlenir (installer da aynı anahtarı
// siler). Yeni kurulumlarda hiç oluşmaz.
const LEGACY_SHELL_EXT_CLSID_KEY =
  'HKCU\\Software\\Classes\\CLSID\\{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}'

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

async function regQuery(key: string, valueName?: string): Promise<string | null> {
  try {
    const args = valueName ? ['query', key, '/v', valueName] : ['query', key, '/ve']
    const { stdout } = await reg(args)
    return stdout
  } catch {
    return null
  }
}

export async function getShellIntegrationStatus(): Promise<ShellIntegrationStatus> {
  if (process.platform !== 'win32') {
    return { supported: false, installed: false, label: null, exePath: null }
  }
  const exePath = currentExePath()
  try {
    const commandOut = await regQuery(SHELL_COMMAND_KEY)
    const installed = Boolean(commandOut && /REG_SZ/.test(commandOut))
    const labelOut = await regQuery(SHELL_KEY)
    const labelMatch = labelOut ? /REG_SZ\s+(.+)/.exec(labelOut) : null
    return {
      supported: true,
      installed,
      label: labelMatch ? labelMatch[1].trim() : null,
      exePath
    }
  } catch {
    return { supported: true, installed: false, label: null, exePath }
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

/** `reg delete` hatası: anahtar yoksa sorun değil. */
function isMissingKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /unable to find|bulunamadı/i.test(message)
}

export async function removeShellIntegration(): Promise<{ success: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { success: false, error: 'unsupported_platform' }
  }
  try {
    await reg(['delete', SHELL_KEY, '/f']).catch((error: unknown) => {
      if (!isMissingKeyError(error)) throw error
    })
    // Eski sürümlerden kalan COM kaydını da temizle; aksi halde
    // paketlenmeyen bir DLL'e işaret eden ölü bir giriş kalır.
    await reg(['delete', LEGACY_SHELL_EXT_CLSID_KEY, '/f']).catch((error: unknown) => {
      if (!isMissingKeyError(error)) throw error
    })
    return { success: true }
  } catch (error) {
    // Zaten yoksa başarı sayılır.
    const message = error instanceof Error ? error.message : String(error)
    if (isMissingKeyError(error)) return { success: true }
    Logger.error('[ShellIntegration] Remove failed:', error)
    return { success: false, error: message }
  }
}
