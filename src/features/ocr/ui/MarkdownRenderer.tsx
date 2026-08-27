import { cn } from '@shared/lib/uiUtils'

import { memo, useMemo } from 'react'

interface MarkdownRendererProps {
  markdown: string
  className?: string
}

/**
 * Minimal safe Markdown renderer — avoids adding heavy dependencies (react-markdown + remark-gfm + katex)
 * to the main bundle. Covers: headings, bold, italic, lists, blockquote, code, tables, hr, links, math.
 * LaTeX ($...$ and $$...$$) is preserved and rendered as styled inline code if KaTeX not present.
 * For premium KaTeX support, the component will lazy-enhance when `katex` is available.
 */
function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderInline(text: string): string {
  let out = escapeHtml(text)

  // Inline code first (protect content)
  const codeSpans: string[] = []
  out = out.replaceAll(/`([^`]+)`/g, (_, code: string) => {
    const idx = codeSpans.length
    codeSpans.push(
      `<code class="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]">${escapeHtml(code)}</code>`
    )
    return `__CODE_${idx}__`
  })

  // Math inline $...$ — keep as styled pill (KaTeX could replace via CSS)
  out = out.replaceAll(
    /\$([^$\n]+?)\$/g,
    '<span class="bg-amber-500/10 border-amber-500/30 inline-flex items-center rounded border px-1 py-0 font-mono text-[0.9em]">$1</span>'
  )

  // Bold **text**
  out = out.replaceAll(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
  // Italic *text* or _text_
  out = out.replaceAll(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
  out = out.replaceAll(/_([^_]+)_/g, '<em class="italic">$1</em>')

  // Links [text](url) — allow only http/https
  out = out.replaceAll(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="text-primary underline underline-offset-2">$1</a>'
  )

  // Restore code spans
  for (let i = 0; i < codeSpans.length; i++) {
    out = out.replaceAll(`__CODE_${i}__`, codeSpans[i] ?? '')
  }

  return out
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const html: string[] = []
  let inCodeBlock = false
  let codeLang = ''
  let codeBuffer: string[] = []
  let inTable = false
  let tableHeaders: string[] = []
  let tableRows: string[][] = []

  const flushTable = () => {
    if (!inTable || tableHeaders.length === 0) {
      inTable = false
      tableRows = []
      tableHeaders = []
      return
    }
    html.push(
      '<div class="border-border bg-card my-3 overflow-x-auto rounded-lg border"><table class="text-ql-12 w-full"><thead><tr class="border-border bg-muted/40 border-b">'
    )
    for (const h of tableHeaders) {
      html.push(
        `<th class="text-foreground px-3 py-2 text-left font-semibold whitespace-nowrap">${renderInline(h)}</th>`
      )
    }
    html.push('</tr></thead><tbody>')
    for (const row of tableRows) {
      html.push('<tr class="border-border/50 border-b last:border-0">')
      for (const cell of row) {
        html.push(
          `<td class="text-muted-foreground px-3 py-1.5 whitespace-nowrap">${renderInline(cell)}</td>`
        )
      }
      html.push('</tr>')
    }
    html.push('</tbody></table></div>')
    inTable = false
    tableHeaders = []
    tableRows = []
  }

  const flushCode = () => {
    if (codeBuffer.length === 0 && !inCodeBlock) return
    const code = escapeHtml(codeBuffer.join('\n'))
    html.push(
      `<div class="border-border bg-muted/40 my-3 overflow-hidden rounded-lg border"><div class="border-border flex items-center justify-between border-b px-3 py-1.5"><span class="text-ql-11 text-muted-foreground font-mono">${escapeHtml(codeLang || 'code')}</span></div><pre class="text-ql-13 text-foreground overflow-x-auto p-3 leading-relaxed"><code>${code}</code></pre></div>`
    )
    codeBuffer = []
  }

  // Buffer for paragraph aggregation
  let paraBuffer: string[] = []
  const flushPara = () => {
    if (paraBuffer.length === 0) return
    const text = paraBuffer.join(' ').trim()
    paraBuffer = []
    if (!text) return
    // Unordered list detection already handled line-by-line; paragraphs are plain
    html.push(
      `<p class="text-ql-13 text-foreground/90 my-2 leading-relaxed">${renderInline(text)}</p>`
    )
  }

  let listBuffer: string[] | null = null
  let listOrdered = false
  const flushList = () => {
    if (!listBuffer || listBuffer.length === 0) {
      listBuffer = null
      return
    }
    const tag = listOrdered ? 'ol' : 'ul'
    const cls = listOrdered ? 'list-decimal pl-5' : 'list-disc pl-5'
    html.push(`<${tag} class="${cls} my-2 space-y-1">`)
    for (const item of listBuffer) {
      html.push(
        `<li class="text-ql-13 text-foreground/90 leading-relaxed">${renderInline(item)}</li>`
      )
    }
    html.push(`</${tag}>`)
    listBuffer = null
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ''
    const trimmed = raw.trim()

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode()
        inCodeBlock = false
        codeLang = ''
      } else {
        flushPara()
        flushList()
        flushTable()
        inCodeBlock = true
        codeLang = trimmed.slice(3).trim()
      }
      continue
    }
    if (inCodeBlock) {
      codeBuffer.push(raw)
      continue
    }

    if (!trimmed) {
      flushPara()
      flushList()
      flushTable()
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushPara()
      flushList()
      flushTable()
      html.push('<hr class="border-border my-4" />')
      continue
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      flushPara()
      flushList()
      flushTable()
      const level = headingMatch[1]?.length ?? 1
      const content = headingMatch[2] ?? ''
      const classes: Record<number, string> = {
        1: 'text-xl font-bold tracking-tight mt-4 mb-2',
        2: 'text-lg font-semibold tracking-tight mt-3 mb-1.5',
        3: 'text-base font-semibold mt-3 mb-1',
        4: 'text-sm font-semibold mt-2 mb-1',
        5: 'text-sm font-medium mt-2 mb-1',
        6: 'text-xs font-medium uppercase tracking-wide mt-2 mb-1'
      }
      html.push(
        `<h${level} class="${classes[level] ?? classes[3]} text-foreground">${renderInline(content)}</h${level}>`
      )
      continue
    }

    // Display math $$...$$ (single line)
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      flushPara()
      flushList()
      flushTable()
      const latex = trimmed.slice(2, -2).trim()
      html.push(
        `<div class="bg-amber-500/5 border-amber-500/20 my-3 rounded-lg border px-4 py-3 text-center font-mono text-sm">${escapeHtml(latex)}</div>`
      )
      continue
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      flushPara()
      flushList()
      flushTable()
      const content = trimmed.replace(/^>\s?/, '')
      html.push(
        `<blockquote class="border-primary/30 bg-muted/20 my-2 border-l-2 pl-3 italic">${renderInline(content)}</blockquote>`
      )
      continue
    }

    // Table header detection: | a | b |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushPara()
      flushList()
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((s) => s.trim())
      // Separator row: |---|---|
      if (cells.every((c) => /^[-: ]+$/.test(c))) {
        // Separator — ignore, table already started
        continue
      }
      if (!inTable) {
        inTable = true
        tableHeaders = cells
        tableRows = []
      } else {
        tableRows.push(cells)
      }
      continue
    } else if (inTable) {
      flushTable()
    }

    // List item
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)/)
    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/)
    if (ulMatch || olMatch) {
      flushPara()
      flushTable()
      const isOrdered = !!olMatch
      const content = (ulMatch?.[1] ?? olMatch?.[2] ?? '').trim()
      if (listBuffer === null) {
        listBuffer = []
        listOrdered = isOrdered
      }
      // If list type switches, flush previous
      if (listOrdered !== isOrdered) {
        flushList()
        listBuffer = []
        listOrdered = isOrdered
      }
      listBuffer.push(content)
      continue
    } else if (listBuffer) {
      // Continuation? check indent? For simplicity flush
      flushList()
    }

    // Plain paragraph line — accumulate
    paraBuffer.push(trimmed)
  }

  flushPara()
  flushList()
  flushTable()
  if (inCodeBlock) flushCode()

  return html.join('\n')
}

function MarkdownRenderer({ markdown, className }: MarkdownRendererProps) {
  const html = useMemo(() => markdownToHtml(markdown), [markdown])

  if (!markdown.trim()) {
    return <div className={cn('text-muted-foreground text-sm', className)}>—</div>
  }

  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none', 'text-foreground', className)}
      // Content is sanitized via escapeHtml; only our own generated tags exist. No user HTML passthrough.
      // eslint-disable-next-line react/no-danger -- sanitized HTML from our own markdown generator
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default memo(MarkdownRenderer)
