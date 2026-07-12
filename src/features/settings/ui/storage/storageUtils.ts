export function formatBytes(bytes: number): string {
  const safe = Math.max(0, bytes)
  if (safe < 1024) return `${safe} B`
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(1)} KB`
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
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
