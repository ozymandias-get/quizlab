import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { CodeBlock, Table } from './parseMessageContentComponents'
import { formatInline } from './parseMessageContentInline'
import {
  BLOCKQUOTE_REGEX,
  HEADING_PREFIX_REGEX,
  HEADING_REGEX,
  HEADING_SIZES,
  HEADING_WEIGHTS,
  HR_REGEX,
  ORDERED_LIST_PREFIX_REGEX,
  ORDERED_LIST_REGEX,
  TASK_CHECKED_REGEX,
  TASK_LIST_REGEX,
  TASK_PREFIX_REGEX,
  UNORDERED_LIST_PREFIX_REGEX,
  UNORDERED_LIST_REGEX
} from './parseMessageContentRegex'
import { CODE_BLOCK_REGEX, TABLE_SEPARATOR_REGEX } from './parseMessageContentRegex'

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

export function renderContent(text: string): ReactNode[] {
  const blocks: ReactNode[] = []
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
