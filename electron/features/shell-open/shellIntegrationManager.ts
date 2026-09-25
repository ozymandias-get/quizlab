import { execFile } from 'child_process'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

import { Logger } from '../../core/logger.js'

const execFileAsync = promisify(execFile)

// Per-user Explorer context-menu konumu. HKCU kullanıldığı için UAC
// gerekmez ve varsayılan PDF handler'ına dokunulmaz — sadece sağ tıkta
// ek bir "QuizLab ile Aç" girdisi çıkar.
const SHELL_KEY = 'HKCU\\Software\\Classes\\SystemFileAssociations\\.pdf\\shell\\QuizlabReader'
const SHELL_COMMAND_KEY = `${SHELL_KEY}\\command`

// Windows 11 üst-menü COM eklentisi kimliği. installer/installer.nsh ve
// shell-ext/src/lib.rs ile AYNI olmalı (identity lock).
export const SHELL_EXT_CLSID = '{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}'
const SHELL_EXT_CLSID_KEY = `HKCU\\Software\\Classes\\CLSID\\${SHELL_EXT_CLSID}`
const SHELL_EXT_SERVER_KEY = `${SHELL_EXT_CLSID_KEY}\\InprocServer32`
const SHELL_EXT_DLL_NAME = 'QuizLabShellExt.dll'

export interface ShellIntegrationStatus {
  supported: boolean
  installed: boolean
  /** COM handler (ExplorerCommandHandler) kaydı var mı. Not: güncel
   * Win11'de tek başına üst (sade) menüye çıkarmaz — orası için paket
   * kimliği (MSIX/Sparse) de gerekir; bkz. docs/windows-installer.md. */
  topLevel: boolean
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

/** Kurulu uygulamanın yanındaki COM DLL yolu (yoksa null). */
function shellExtDllPath(exePath: string): string | null {
  const dllPath = path.join(path.dirname(exePath), 'resources', 'shell', SHELL_EXT_DLL_NAME)
  try {
    if (fs.existsSync(dllPath)) return dllPath
  } catch {
    // existsSync hatası = yok say.
  }
  return null
}

async function isTopLevelRegistered(dllPath: string | null): Promise<boolean> {
  if (!dllPath) return false
  const [serverOut, handlerOut] = await Promise.all([
    regQuery(SHELL_EXT_SERVER_KEY),
    regQuery(SHELL_KEY, 'ExplorerCommandHandler')
  ])
  if (!serverOut || !handlerOut) return false
  return (
    serverOut.toLowerCase().includes(dllPath.toLowerCase()) &&
    handlerOut.toUpperCase().includes(SHELL_EXT_CLSID.toUpperCase())
  )
}

export async function getShellIntegrationStatus(): Promise<ShellIntegrationStatus> {
  if (process.platform !== 'win32') {
    return { supported: false, installed: false, topLevel: false, label: null, exePath: null }
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
      topLevel: await isTopLevelRegistered(shellExtDllPath(exePath)),
      label: labelMatch ? labelMatch[1].trim() : null,
      exePath
    }
  } catch {
    return { supported: true, installed: false, topLevel: false, label: null, exePath }
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

    // Windows 11 üst menüsü: DLL paketteyse COM kaydını da yaz.
    // Dev modunda (electron . ile çalışırken) DLL yoktur — o durumda
    // klasik menü kurulur, üst menü sessizce atlanır.
    const dllPath = shellExtDllPath(exePath)
    if (dllPath) {
      await reg(['add', SHELL_EXT_CLSID_KEY, '/ve', '/d', 'QuizLab Shell Extension', '/f'])
      await reg(['add', SHELL_EXT_SERVER_KEY, '/ve', '/d', dllPath, '/f'])
      await reg(['add', SHELL_EXT_SERVER_KEY, '/v', 'ThreadingModel', '/d', 'Apartment', '/f'])
      await reg(['add', SHELL_KEY, '/v', 'ExplorerCommandHandler', '/d', SHELL_EXT_CLSID, '/f'])
    } else {
      Logger.warn('[ShellIntegration] DLL not found, top-level menu skipped:', exePath)
    }
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
    await reg(['delete', SHELL_KEY, '/f']).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      if (!/unable to find|bulunamadı/i.test(message)) throw error
    })
    await reg(['delete', SHELL_EXT_CLSID_KEY, '/f']).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      if (!/unable to find|bulunamadı/i.test(message)) throw error
    })
    return { success: true }
  } catch (error) {
    // Zaten yoksa başarı sayılır.
    const message = error instanceof Error ? error.message : String(error)
    if (/unable to find|bulunamadı/i.test(message)) return { success: true }
    Logger.error('[ShellIntegration] Remove failed:', error)
    return { success: false, error: message }
  }
}
