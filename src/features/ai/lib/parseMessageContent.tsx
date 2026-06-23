import { Check } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'

import { CodeBlock, Table } from './parseMessageContentComponents'

// ── Regexes (hoisted to module scope so V8 doesn't re-evaluate the literal
//    on every MessageContent render) ─────────────────────────────────────────
const INLINE_REGEX =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+]\([^)]+\)|https?:\/\/[^\s"'<>]+)/g
const CODE_BLOCK_REGEX = /```(\w*)\n?([\S\s]*?)```/g
const HEADING_REGEX = /^#{1,6}\s/
const HEADING_PREFIX_REGEX = /^#+/
const BLOCKQUOTE_REGEX = /^>/
const HR_REGEX = /^---+\s*$/
const TASK_LIST_REGEX = /^-?\s*\[[\sXx]?]\s/
const TASK_CHECKED_REGEX = /\[[Xx]]/
const TASK_PREFIX_REGEX = /^-?\s*\[[\sXx]?]\s*/
const ORDERED_LIST_REGEX = /^(\d+)\.\s/
const ORDERED_LIST_PREFIX_REGEX = /^\d+\.\s*/
const UNORDERED_LIST_REGEX = /^[*+-]\s/
const UNORDERED_LIST_PREFIX_REGEX = /^[*+-]\s*/
const TABLE_SEPARATOR_REGEX = /^[\s:|-]+$/

// Heading visual scale (1–6 → class names) ─────────────────────────────────
const HEADING_SIZES = [
  'text-ql-18',
  'text-ql-16',
  'text-ql-15',
  'text-ql-14',
  'text-ql-13',
  'text-ql-13'
]
const HEADING_WEIGHTS = [
  'font-bold',
  'font-bold',
  'font-semibold',
  'font-semibold',
  'font-medium',
  'font-medium'
]

function formatInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  // Reuse a single regex instance per call. `g` flag is fine because we walk
  // the string linearly with `lastIndex` and never reuse the instance.
  const regex = INLINE_REGEX
  regex.lastIndex = 0
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    if (match[1]) {
      parts.push(
        <code
          key={`c-${match.index}`}
          className="text-ql-12 rounded bg-amber-500/10 px-1 py-0.5 font-mono text-amber-300"
        >
          {match[1].slice(1, -1)}
        </code>
      )
    } else if (match[2]) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-white/90">
          {match[2].slice(2, -2)}
        </strong>
      )
    } else if (match[3]) {
      parts.push(
        <em key={`i-${match.index}`} className="text-white/80 italic">
          {match[3].slice(1, -1)}
        </em>
      )
    } else if (match[4]) {
      parts.push(
        <span key={`s-${match.index}`} className="text-white/50 line-through">
          {match[4].slice(2, -2)}
        </span>
      )
    } else if (match[5]) {
      const isBareUrl = !match[5].includes('](')
      if (isBareUrl) {
        const url = match[5]
        parts.push(
          <a
            key={`a-${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 underline decoration-amber-400/30 underline-offset-2 transition-colors hover:decoration-amber-400/60"
          >
            {url}
          </a>
        )
      } else {
        const urlEnd = match[5].indexOf('](')
        const linkText = match[5].slice(1, urlEnd)
        const linkUrl = match[5].slice(urlEnd + 2, -1)
        parts.push(
          <a
            key={`a-${match.index}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 underline decoration-amber-400/30 underline-offset-2 transition-colors hover:decoration-amber-400/60"
          >
            {linkText}
          </a>
        )
      }
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return parts
}

function renderLine(line: string, lineIndex: number): ReactNode {
  const trimmed = line.trim()

  if (!trimmed) {
    return <div key={`l-${lineIndex}`} className="h-2" />
  }

  if (HEADING_REGEX.test(trimmed)) {
    const level = trimmed.match(HEADING_PREFIX_REGEX)![0].length
    const text = trimmed.replace(HEADING_PREFIX_REGEX, '').replace(/^\s+/, '')
    return (
      <div
        key={`l-${lineIndex}`}
        className={`${HEADING_SIZES[level - 1]} ${HEADING_WEIGHTS[level - 1]} mt-3 mb-1.5 text-white/90`}
      >
        {formatInline(text)}
      </div>
    )
  }

  if (BLOCKQUOTE_REGEX.test(trimmed)) {
    const text = trimmed.replace(/^>\s?/, '')
    return (
      <div
        key={`l-${lineIndex}`}
        className="my-1.5 border-l-2 border-amber-500/40 py-0.5 pl-3 text-white/60 italic"
      >
        {formatInline(text)}
      </div>
    )
  }

  if (HR_REGEX.test(trimmed)) {
    return <div key={`l-${lineIndex}`} className="my-3 border-t border-white/8" />
  }

  if (TASK_LIST_REGEX.test(trimmed)) {
    const checked = TASK_CHECKED_REGEX.test(trimmed)
    const text = trimmed.replace(TASK_PREFIX_REGEX, '')
    return (
      <div key={`l-${lineIndex}`} className="my-1 ml-1 flex gap-2">
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-amber-500/50 bg-amber-500/30' : 'border-white/20'}`}
        >
          {checked && <Check className="h-2.5 w-2.5 text-amber-300" />}
        </span>
        <span className={`text-white/80 ${checked ? 'text-white/40 line-through' : ''}`}>
          {formatInline(text)}
        </span>
      </div>
    )
  }

  const numMatch = trimmed.match(ORDERED_LIST_REGEX)
  if (numMatch) {
    const num = numMatch[1]
    const text = trimmed.replace(ORDERED_LIST_PREFIX_REGEX, '')
    return (
      <div key={`l-${lineIndex}`} className="my-0.5 ml-1 flex gap-2">
        <span className="shrink-0 text-white/40 select-none">{num}.</span>
        <span className="text-white/80">{formatInline(text)}</span>
      </div>
    )
  }

  if (UNORDERED_LIST_REGEX.test(trimmed)) {
    const text = trimmed.replace(UNORDERED_LIST_PREFIX_REGEX, '')
    return (
      <div key={`l-${lineIndex}`} className="my-0.5 ml-1 flex gap-2">
        <span className="shrink-0 text-white/40">•</span>
        <span className="text-white/80">{formatInline(text)}</span>
      </div>
    )
  }

  return (
    <div key={`l-${lineIndex}`} className="my-0.5 text-white/80">
      {formatInline(line)}
    </div>
  )
}

function parseTableBlock(
  lines: string[],
  startIdx: number
): { table: ReactNode; consumed: number } | null {
  if (startIdx + 2 >= lines.length) return null
  const headerLine = lines[startIdx].trim()
  const sepLine = lines[startIdx + 1].trim()

  if (!headerLine.includes('|') || !TABLE_SEPARATOR_REGEX.test(sepLine)) return null

  const headers = headerLine
    .split('|')
    .filter((s) => s.trim())
    .map((s) => s.trim())
  const rows: string[][] = []
  let i = startIdx + 2

  while (i < lines.length && lines[i].trim().includes('|')) {
    const cells = lines[i]
      .split('|')
      .filter((s) => s.trim())
      .map((s) => s.trim())
    if (cells.length > 0) rows.push(cells)
    i++
  }

  return {
    table: <Table key={`tbl-${startIdx}`} headers={headers} rows={rows} />,
    consumed: i - startIdx
  }
}

function renderContent(text: string): ReactNode[] {
  const blocks: ReactNode[] = []
  // Reuse the hoisted regex; reset lastIndex so a prior call's state can't leak.
  CODE_BLOCK_REGEX.lastIndex = 0
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      const lines = before.split('\n')
      let li = 0
      while (li < lines.length) {
        const trimmed = lines[li].trim()
        if (
          trimmed.includes('|') &&
          li + 1 < lines.length &&
          TABLE_SEPARATOR_REGEX.test(lines[li + 1].trim())
        ) {
          const result = parseTableBlock(lines, li)
          if (result) {
            blocks.push(result.table)
            li += result.consumed
            continue
          }
        }
        blocks.push(renderLine(lines[li], li))
        li++
      }
    }
    const lang = match[1] || 'text'
    const code = match[2].trimEnd()
    blocks.push(<CodeBlock key={`c-${match.index}`} code={code} lang={lang} />)
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    const after = text.slice(lastIndex)
    const lines = after.split('\n')
    let li = 0
    while (li < lines.length) {
      const trimmed = lines[li].trim()
      if (
        trimmed.includes('|') &&
        li + 1 < lines.length &&
        TABLE_SEPARATOR_REGEX.test(lines[li + 1].trim())
      ) {
        const result = parseTableBlock(lines, li)
        if (result) {
          blocks.push(result.table)
          li += result.consumed
          continue
        }
      }
      blocks.push(renderLine(lines[li], li + 1000))
      li++
    }
  }

  return blocks
}

function MessageContent({ content }: { content: string }) {
  const rendered = useMemo(() => renderContent(content), [content])
  return <div className="space-y-0.5">{rendered}</div>
}

export default MessageContent
