import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../constants/googleAiWebApps.js'
import { isSiteSessionSlot } from '../constants/siteSessionSlots.js'

export function googleSlotForPartition(partition: string): number | null {
  if (partition === GOOGLE_AI_WEB_SESSION_PARTITION) return 1
  const prefix = `${GOOGLE_AI_WEB_SESSION_PARTITION}_slot_`
  if (partition.startsWith(prefix)) {
    const suffix = partition.slice(prefix.length)
    const slot = Number(suffix)
    if (isSiteSessionSlot(slot) && slot > 1 && String(slot) === suffix) return slot
  }
  return null
}

/** Google cookies contain the whole account list; the URL chooses its member. */
export function googleSessionUrl(rawUrl: string, slot: number): string {
  if (!isSiteSessionSlot(slot)) return rawUrl
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') return rawUrl
  const index = String(slot - 1)
  switch (url.hostname) {
    case 'gemini.google.com':
    case 'aistudio.google.com':
      url.pathname = `/u/${index}${url.pathname.replace(/^\/u\/\d+(?=\/|$)/, '') || '/'}`
      break
    case 'drive.google.com':
      if (/^\/drive(?:\/|$)/.test(url.pathname)) {
        url.pathname = url.pathname.replace(/^\/drive(?:\/u\/\d+)?(?=\/|$)/, `/drive/u/${index}`)
      }
      break
    case 'www.youtube.com':
    case 'youtube.com':
    case 'notebooklm.google.com':
      break
    default:
      return rawUrl
  }
  url.searchParams.set('authuser', index)
  return url.toString()
}
