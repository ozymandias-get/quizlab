export const INLINE_REGEX =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+]\([^)]+\)|https?:\/\/[^\s"'<>]+)/g
export const CODE_BLOCK_REGEX = /```(\w*)\n?([\S\s]*?)```/g
export const HEADING_REGEX = /^#{1,6}\s/
export const HEADING_PREFIX_REGEX = /^#+/
export const BLOCKQUOTE_REGEX = /^>/
export const HR_REGEX = /^---+\s*$/
export const TASK_LIST_REGEX = /^-?\s*\[[\sXx]?]\s/
export const TASK_CHECKED_REGEX = /\[[Xx]]/
export const TASK_PREFIX_REGEX = /^-?\s*\[[\sXx]?]\s*/
export const ORDERED_LIST_REGEX = /^(\d+)\.\s/
export const ORDERED_LIST_PREFIX_REGEX = /^\d+\.\s*/
export const UNORDERED_LIST_REGEX = /^[*+-]\s/
export const UNORDERED_LIST_PREFIX_REGEX = /^[*+-]\s*/
export const TABLE_SEPARATOR_REGEX = /^[\s:|-]+$/

export const HEADING_SIZES = [
  'text-ql-18',
  'text-ql-16',
  'text-ql-15',
  'text-ql-14',
  'text-ql-13',
  'text-ql-13'
]
export const HEADING_WEIGHTS = [
  'font-bold',
  'font-bold',
  'font-semibold',
  'font-semibold',
  'font-medium',
  'font-medium'
]

export const ALLOWED_URL_PROTOCOLS = ['http:', 'https:', 'mailto:']

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)
  } catch {
    return false
  }
}
