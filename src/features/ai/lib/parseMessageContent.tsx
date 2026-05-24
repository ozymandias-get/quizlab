import { useMemo, type ReactNode } from 'react'

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const handleCopy = () => navigator.clipboard.writeText(code)

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-white/8 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-1.5">
        <span className="text-ql-11 text-white/40 font-mono">{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded px-2 py-0.5 text-ql-11 text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-ql-13 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-white/8">
      <table className="w-full text-ql-12">
        <thead>
          <tr className="border-b border-white/8 bg-white/[0.03]">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-white/60 font-medium whitespace-nowrap"
              >
                {h.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/[0.04] last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-white/70 whitespace-nowrap">
                  {cell.trim()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const regex =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>"']+)/g
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
          className="rounded bg-amber-500/10 px-1 py-0.5 text-ql-12 text-amber-300 font-mono"
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
        <em key={`i-${match.index}`} className="italic text-white/80">
          {match[3].slice(1, -1)}
        </em>
      )
    } else if (match[4]) {
      parts.push(
        <span key={`s-${match.index}`} className="line-through text-white/50">
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
            className="text-amber-400 underline decoration-amber-400/30 hover:decoration-amber-400/60 underline-offset-2 transition-colors"
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
            className="text-amber-400 underline decoration-amber-400/30 hover:decoration-amber-400/60 underline-offset-2 transition-colors"
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

  if (/^#{1,6}\s/.test(trimmed)) {
    const level = trimmed.match(/^#+/)![0].length
    const text = trimmed.replace(/^#+\s*/, '')
    const sizes = [
      'text-ql-18',
      'text-ql-16',
      'text-ql-15',
      'text-ql-14',
      'text-ql-13',
      'text-ql-13'
    ]
    const weights = [
      'font-bold',
      'font-bold',
      'font-semibold',
      'font-semibold',
      'font-medium',
      'font-medium'
    ]
    return (
      <div
        key={`l-${lineIndex}`}
        className={`${sizes[level - 1]} ${weights[level - 1]} text-white/90 mt-3 mb-1.5`}
      >
        {formatInline(text)}
      </div>
    )
  }

  if (/^>/.test(trimmed)) {
    const text = trimmed.replace(/^>\s?/, '')
    return (
      <div
        key={`l-${lineIndex}`}
        className="border-l-2 border-amber-500/40 pl-3 py-0.5 my-1.5 text-white/60 italic"
      >
        {formatInline(text)}
      </div>
    )
  }

  if (/^---+\s*$/.test(trimmed)) {
    return <div key={`l-${lineIndex}`} className="border-t border-white/8 my-3" />
  }

  if (/^-?\s*\[[\sxX]?\]\s/.test(trimmed)) {
    const checked = /\[[xX]\]/.test(trimmed)
    const text = trimmed.replace(/^-?\s*\[[\sxX]?\]\s*/, '')
    return (
      <div key={`l-${lineIndex}`} className="flex gap-2 ml-1 my-1">
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'bg-amber-500/30 border-amber-500/50' : 'border-white/20'}`}
        >
          {checked && (
            <svg
              className="h-2.5 w-2.5 text-amber-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <span className={`text-white/80 ${checked ? 'text-white/40 line-through' : ''}`}>
          {formatInline(text)}
        </span>
      </div>
    )
  }

  const numMatch = trimmed.match(/^(\d+)\.\s/)
  if (numMatch) {
    const num = numMatch[1]
    const text = trimmed.replace(/^\d+\.\s*/, '')
    return (
      <div key={`l-${lineIndex}`} className="flex gap-2 ml-1 my-0.5">
        <span className="text-white/40 shrink-0 select-none">{num}.</span>
        <span className="text-white/80">{formatInline(text)}</span>
      </div>
    )
  }

  if (/^[-*+]\s/.test(trimmed)) {
    const text = trimmed.replace(/^[-*+]\s*/, '')
    return (
      <div key={`l-${lineIndex}`} className="flex gap-2 ml-1 my-0.5">
        <span className="text-white/40 shrink-0">•</span>
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

  if (!headerLine.includes('|') || !/^[\s:|:-]+$/.test(sepLine)) return null

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
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      const lines = before.split('\n')
      let li = 0
      while (li < lines.length) {
        const trimmed = lines[li].trim()
        if (
          trimmed.includes('|') &&
          li + 1 < lines.length &&
          /^[\s:|:-]+$/.test(lines[li + 1].trim())
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
        /^[\s:|:-]+$/.test(lines[li + 1].trim())
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

export function MessageContent({ content }: { content: string }) {
  const rendered = useMemo(() => renderContent(content), [content])
  return <div className="space-y-0.5">{rendered}</div>
}

export function InlineContent({ content }: { content: string }) {
  const parts = useMemo(() => formatInline(content), [content])
  return <>{parts}</>
}
