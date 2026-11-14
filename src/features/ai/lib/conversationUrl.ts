/**
 * Canonical conversation URL used as the identity half of `modelId::url`.
 *
 * Pinned projects and recent work both key rows by this value, so the rule lives
 * in one place: a fragment never identifies a conversation and would split one
 * chat into two rows.
 */
export function normalizeConversationUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}
