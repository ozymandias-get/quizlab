const MAX_REQUEST_BODY_SIZE = 20 * 1024 * 1024

const MAX_MESSAGE_TEXT_LENGTH = 100_000

type ChatContentItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface ChatCompletionBody {
  model: string
  messages: Array<{
    role: string
    content: string | ChatContentItem[]
  }>
}

interface ModelListItem {
  id: string
}

const isValidChatContentItem = (content: unknown): content is ChatContentItem => {
  if (!content || typeof content !== 'object') return false
  const i = content as Record<string, unknown>
  if (i.type === 'text') {
    return typeof i.text === 'string'
  }
  if (i.type === 'image_url') {
    return !!(
      i.image_url &&
      typeof i.image_url === 'object' &&
      typeof (i.image_url as Record<string, unknown>).url === 'string'
    )
  }
  return false
}

function sanitizeTextContent(content: unknown): string {
  return typeof content === 'string' ? content.slice(0, MAX_MESSAGE_TEXT_LENGTH) : ''
}

function sanitizeChatMessage(
  msg: unknown
): { role: string; content: string; images?: string[] } | null {
  if (!msg || typeof msg !== 'object') return null
  const m = msg as Record<string, unknown>

  // Assistant turns carry the model's own previous replies and are required
  // for multi-turn context. They never carry images.
  if (m.role !== 'user' && m.role !== 'assistant') return null

  const content = sanitizeTextContent(m.content)
  if (!content) return null

  let images: string[] | undefined
  if (m.role === 'user' && Array.isArray(m.images)) {
    images = m.images.filter((img): img is string => typeof img === 'string')
  }

  return { role: m.role, content, images }
}

export {
  isValidChatContentItem,
  MAX_MESSAGE_TEXT_LENGTH,
  MAX_REQUEST_BODY_SIZE,
  sanitizeChatMessage
}
export type { ChatCompletionBody, ChatContentItem, ModelListItem }
