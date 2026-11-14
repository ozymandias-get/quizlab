/**
 * Canonical conversation URL used as the identity half of `modelId::url`.
 *
 * Pinned projects and recent work both key rows by this value, so the rule lives
 * in one place: a fragment never identifies a conversation and would split one
 * chat into two rows.
 *
 * Provider hosts that permanently redirect to a canonical host are rewritten as
 * well: a tab restored from an older session keeps the pre-redirect URL, while a
 * live send reports the canonical one, and without this the same chat would be
 * stored as two rows. Only aliases verified to preserve the path are listed.
 * `www` is deliberately not stripped in general, because YouTube and Perplexity
 * use the `www` host as their canonical one. Query parameters are left untouched:
 * they can carry provider state (for example the selected model).
 */
const HOST_ALIASES = new Map([
  ['chat.openai.com', 'chatgpt.com'],
  ['www.chatgpt.com', 'chatgpt.com'],
  ['www.claude.ai', 'claude.ai'],
  ['perplexity.ai', 'www.perplexity.ai'],
  ['youtube.com', 'www.youtube.com']
])

export function normalizeConversationUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.hash = ''
    const canonicalHost = HOST_ALIASES.get(url.hostname)
    if (canonicalHost) url.hostname = canonicalHost
    return url.toString()
  } catch {
    return null
  }
}
