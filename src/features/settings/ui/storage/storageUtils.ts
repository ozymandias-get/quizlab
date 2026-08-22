export function formatBytes(bytes: number): string {
  const safe = Math.max(0, bytes)
  if (safe < 1024) return `${safe} B`
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(1)} KB`
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTimeAgo(timestamp: number, language = 'en'): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  // Use i18n-like buckets but delegate pluralization to Intl when possible;
  // we keep simple {count} interpolation for consistency with common.json keys.
  // For Turkish 'az önce' etc, caller passes language to pick correct string via Intl or manual.
  const locale = language === 'tr' ? 'tr-TR' : 'en-US'
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (minutes < 1) {
      // Keep short 'just now' / 'az önce' for <1m to avoid 'in 0 minutes'
      return language === 'tr' ? 'az önce' : 'just now'
    }
    if (minutes < 60) return rtf.format(-minutes, 'minute')
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return rtf.format(-hours, 'hour')
    const days = Math.floor(hours / 24)
    return rtf.format(-days, 'day')
  } catch {
    if (minutes < 1) return language === 'tr' ? 'az önce' : 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }
}

export function partitionDisplayName(partitionKey: string): string {
  const key = partitionKey.replace(/^persist:/, '')

  const known: Record<string, string> = {
    ai_session: 'AI Session',
    gemini_web_profile: 'Gemini Web',
    grok: 'Grok'
  }
  if (known[key]) return known[key]

  if (key.startsWith('ai_custom_')) return 'Custom Platform'

  if (key.startsWith('ai_')) {
    const name = key.replace(/^ai_/, '')
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  return key
}
