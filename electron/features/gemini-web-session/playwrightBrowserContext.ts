import path from 'path'
import { existsSync } from 'fs'

/** Methods used from Playwright `Page` in this module only. */
export interface PageLike {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  url(): string
  evaluate(script: string): Promise<unknown>
  waitForLoadState(state: string, options?: { timeout: number }): Promise<unknown>
  isClosed(): boolean
}

/** Methods used from Playwright `BrowserContext` in this module only. */
export interface BrowserContextLike {
  cookies(urls: readonly string[]): Promise<unknown>
  pages(): PageLike[]
  newPage(): Promise<PageLike>
  setDefaultTimeout(timeout: number): void
  setDefaultNavigationTimeout(timeout: number): void
  close(): Promise<unknown>
}

export function resolveSystemBrowserPath(): string | null {
  const candidates: string[] = []

  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    const localAppData = process.env.LOCALAPPDATA || ''

    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    )
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    )
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    )
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }

  return null
}

export async function ensureActivePage(context: BrowserContextLike): Promise<PageLike | null> {
  const pages = context.pages().filter((page) => !page.isClosed())
  if (pages.length > 0) {
    return pages[pages.length - 1]
  }
  return context.newPage().catch(() => null)
}
