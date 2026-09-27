const MAX_REQUEST_BODY_SIZE = 20 * 1024 * 1024

const MAX_MESSAGE_TEXT_LENGTH = 100_000

/**
 * Ceiling for one encoded attachment. A single image above this would consume
 * most of `MAX_REQUEST_BODY_SIZE` and get the whole request rejected, so it is
 * dropped here instead of failing every turn it appears in.
 */
const MAX_SINGLE_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * Attachments must be inline image data URLs. `http(s):` and `blob:` sources
 * cannot be dereferenced by a remote provider, and other schemes are never a
 * valid `image_url.url` here. The subtype stays open so uncommon-but-valid
 * encodings are not silently discarded.
 */
const IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i

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

function isAcceptableImage(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!IMAGE_DATA_URL.test(value)) return false
  // Base64 payloads are ASCII, so the string length tracks the byte count and
  // no decode is needed to enforce the cap.
  return value.length <= MAX_SINGLE_IMAGE_BYTES
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

  let images: string[] | undefined
  if (m.role === 'user' && Array.isArray(m.images)) {
    images = m.images.filter(isAcceptableImage)
  }

  // An attachment with no typed text is a valid user turn: the composer allows
  // sending images on their own, and the PDF/screenshot flows produce
  // image-only turns whenever no note was written. Dropping those here would
  // strip the image from the request so the model would answer as if nothing
  // was sent. Every other empty turn is still discarded so blank noise never
  // becomes context.
  if (!content && !images?.length) return null

  return { role: m.role, content, images }
}

type SanitizedChatMessage = NonNullable<ReturnType<typeof sanitizeChatMessage>>

/**
 * Turn sanitized transcript turns into OpenAI-style `messages` entries.
 *
 * Turns carrying images become a multimodal content array. The text part is
 * only emitted when there is actual text: providers reject an empty text block
 * (Anthropic-compatible gateways, Ollama), and image-only turns are the norm
 * for the attachment and PDF/screenshot flows.
 */
function buildChatCompletionMessages(
  messages: SanitizedChatMessage[]
): ChatCompletionBody['messages'] {
  return messages.map(({ role, content, images }) => {
    if (!images || images.length === 0) {
      return { role, content }
    }

    const parts: ChatContentItem[] = []
    if (content.trim().length > 0) {
      parts.push({ type: 'text', text: content })
    }
    for (const url of images) {
      parts.push({ type: 'image_url', image_url: { url } })
    }
    return { role, content: parts }
  })
}

export {
  buildChatCompletionMessages,
  isValidChatContentItem,
  MAX_MESSAGE_TEXT_LENGTH,
  MAX_REQUEST_BODY_SIZE,
  MAX_SINGLE_IMAGE_BYTES,
  sanitizeChatMessage
}
export type { ChatCompletionBody, ModelListItem }
