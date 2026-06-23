import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'
import type { GeminiWebSessionStatus, PdfSelection } from '@shared-core/types'

const objectUrls = new Set<string>()
let beforeUnloadListenerRegistered = false

export const getPlatform = (): string => {
  const platform = navigator.platform.toLowerCase()
  if (platform.includes('mac')) return 'darwin'
  if (platform.includes('win')) return 'win32'
  if (platform.includes('linux')) return 'linux'
  return 'web'
}

export const createGeminiStatus = (
  enabled: boolean,
  enabledAppIds: GoogleWebSessionAppId[]
): GeminiWebSessionStatus => ({
  state: enabled ? 'auth_required' : 'uninitialized',
  lastHealthyAt: null,
  lastCheckAt: new Date().toISOString(),
  consecutiveFailures: 0,
  reasonCode: 'none',
  featureEnabled: enabled,
  enabled,
  enabledAppIds
})

export const toMapRecord = <T>(map: Map<string, T>): Record<string, T> => {
  const record: Record<string, T> = {}
  for (const [key, value] of map.entries()) {
    record[key] = value
  }
  return record
}

const trackObjectUrl = (objectUrl: string) => {
  objectUrls.add(objectUrl)
  return objectUrl
}

const revokeTrackedObjectUrls = () => {
  for (const objectUrl of objectUrls) {
    URL.revokeObjectURL(objectUrl)
  }
  objectUrls.clear()
}

/**
 * Revoke a single tracked object URL.  Call this when a PDF tab is closed
 * or a new document is loaded to prevent Object URL accumulation in SPA
 * mode (where beforeunload may not fire for hours).
 */
export const revokeObjectUrl = (objectUrl: string): void => {
  if (objectUrls.has(objectUrl)) {
    URL.revokeObjectURL(objectUrl)
    objectUrls.delete(objectUrl)
  }
}

export const registerBeforeUnloadCleanup = () => {
  if (typeof window !== 'undefined' && !beforeUnloadListenerRegistered) {
    window.addEventListener('beforeunload', revokeTrackedObjectUrls, { once: true })
    beforeUnloadListenerRegistered = true
  }
}

export const parseUrlWithAllowedProtocols = (
  rawUrl: string,
  allowedProtocols: readonly string[]
): URL | null => {
  try {
    const parsedUrl = new URL(rawUrl.trim())
    if (!allowedProtocols.includes(parsedUrl.protocol)) return null
    return parsedUrl
  } catch {
    return null
  }
}

export const selectPdfInBrowser = (): Promise<PdfSelection | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,application/pdf'
    const cleanup = () => {
      input.onchange = null
    }
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        cleanup()
        resolve(null)
        return
      }

      const streamUrl = trackObjectUrl(URL.createObjectURL(file))
      cleanup()
      resolve({
        path: '',
        name: file.name,
        size: file.size,
        streamUrl
      })
    }
    input.click()
  })
}
