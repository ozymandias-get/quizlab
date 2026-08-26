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

export function activityLabel(category: string, t: (k: string) => string): string {
  if (category === 'active') return t('partition_activity_active')
  if (category === 'passive') return t('partition_activity_passive')
  return t('partition_activity_cold')
}

export function activityColor(category: string): string {
  if (category === 'active') return 'bg-emerald-500'
  if (category === 'passive') return 'bg-amber-500'
  return 'bg-slate-400'
}

export function pressureLabel(level: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    normal: t('cache_pressure_normal'),
    moderate: t('cache_pressure_moderate'),
    warning: t('cache_pressure_warning'),
    high: t('cache_pressure_high'),
    critical: t('cache_pressure_critical')
  }
  return map[level] ?? level
}

export function pressureColor(level: string): string {
  switch (level) {
    case 'critical':
      return 'bg-rose-500'
    case 'high':
      return 'bg-orange-500'
    case 'warning':
      return 'bg-amber-500'
    case 'moderate':
      return 'bg-yellow-500'
    default:
      return 'bg-emerald-500'
  }
}
