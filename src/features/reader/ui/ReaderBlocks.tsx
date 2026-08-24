/* eslint-disable react/no-array-index-key -- list items use index as key, no stable id available from Docling */
import type { QuizLabBlock } from '@shared-core/types'

import { cn } from '@shared/lib/uiUtils'

import { BlockWrapper } from './ReaderBlockShell'
import { ImageBlockView, TableBlockView } from './ReaderMediaBlocks'
import { FootnotePopover, ReferenceLink } from './ReferencePopover'

function parseInlineReferences(text: string): React.ReactNode[] {
  // Dipnot [1], [2] ve şekil/tablo çapraz referansları için inline link çözümleme
  const parts: React.ReactNode[] = []
  // Regex: [1] dipnot, Şekil 3 / Figure 3 / Tablo 2 / Table 2 / Bkz. Şekil 3
  const regex =
    /(\[\d+\]|Bkz\.?\s*(?:Şekil|Figure|Tablo|Table)\s*\d+|(?:Şekil|Figure|Tablo|Table)\s*\d+)/gi
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index)
    if (before) parts.push(before)
    const token = match[0]
    const footnoteMatch = token.match(/^\[(\d+)\]$/)
    if (footnoteMatch) {
      const num = footnoteMatch[1]
      parts.push(<FootnotePopover key={`fn-${key++}-${num}`} refNumber={num!} token={token} />)
    } else {
      // Şekil / Tablo çapraz bağı
      const numMatch = token.match(/(\d+)/)
      const num = numMatch ? numMatch[1] : ''
      const isTable = /tablo|table/i.test(token)
      const label = isTable ? `Tablo ${num}` : `Şekil ${num}`
      parts.push(<ReferenceLink key={`ref-${key++}-${label}`} label={label} rawToken={token} />)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : [text]
}

export function HeadingBlockView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'heading' }>
  documentId?: string
}) {
  const Tag = `h${Math.min(6, Math.max(1, block.level))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  const level1 = block.level === 1
  const ariaLevel = Math.min(6, Math.max(1, block.level))
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <Tag
        id={`heading-${block.id}`}
        role="heading"
        aria-level={ariaLevel}
        tabIndex={-1}
        className={cn(
          'text-foreground mt-7 mb-2 font-semibold tracking-tight first:mt-0',
          level1
            ? 'border-primary/40 relative border-l-2 pl-3 text-[1.35rem] leading-7'
            : 'text-ql-15 text-[1.1rem] opacity-95'
        )}
      >
        {block.text}
      </Tag>
    </BlockWrapper>
  )
}

export function ParagraphBlockView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'paragraph' }>
  documentId?: string
}) {
  const richContent = parseInlineReferences(block.text)
  const hasRich = richContent.length !== 1 || richContent[0] !== block.text
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <p
        role="paragraph"
        className="text-foreground/90 text-ql-14 my-3 leading-7 select-text"
        aria-label={block.text.slice(0, 120)}
      >
        {hasRich ? richContent : block.text}
      </p>
    </BlockWrapper>
  )
}

export function ListBlockView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'list' }>
  documentId?: string
}) {
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <Tag
        role={block.ordered ? 'list' : 'list'}
        aria-label={block.ordered ? 'Sıralı liste' : 'Sırasız liste'}
        className={cn(
          'my-3 list-outside space-y-1 pl-6',
          block.ordered ? 'list-decimal' : 'list-disc'
        )}
      >
        {block.items.map((item, i) => {
          const rich = parseInlineReferences(item)
          const hasRich = rich.length !== 1 || rich[0] !== item
          return (
            <li key={i} className="text-ql-14 leading-7 select-text">
              {hasRich ? rich : item}
            </li>
          )
        })}
      </Tag>
    </BlockWrapper>
  )
}

export function CodeBlockView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'code' }>
  documentId?: string
}) {
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <pre
        role="region"
        aria-label="Kod bloğu"
        className="bg-muted border-border text-ql-13 my-4 overflow-x-auto rounded-xl border p-4 font-mono leading-6"
      >
        <code>{block.text}</code>
      </pre>
    </BlockWrapper>
  )
}

export function FormulaBlockView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'formula' }>
  documentId?: string
}) {
  const raw = block.latex ?? block.text
  // Lazy KaTeX render: if katex is available, render; otherwise fallback to monospace
  let rendered: React.ReactNode = raw
  try {
    const katex = require('katex') as { renderToString: (tex: string, opts: unknown) => string }
    if (katex?.renderToString) {
      const html = katex.renderToString(raw, { throwOnError: false, displayMode: true })
      // eslint-disable-next-line react/no-danger
      rendered = <span dangerouslySetInnerHTML={{ __html: html }} />
    }
  } catch {
    // Fallback to plain text if katex not installed (keeps bundle small)
  }
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <div
        role="math"
        aria-label={raw}
        className="bg-muted/40 border-border text-ql-13 my-4 rounded-xl border p-4"
      >
        {rendered}
      </div>
    </BlockWrapper>
  )
}

export function CaptionView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'caption' }>
  documentId?: string
}) {
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <p role="caption" className="text-muted-foreground text-ql-12 my-2 italic select-text">
        {block.text}
      </p>
    </BlockWrapper>
  )
}

export function UnknownBlockView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'unknown' }>
  documentId?: string
}) {
  if (!block.rawText) return null
  const isFootnote =
    /^\s*\[?\d+\]?[\s.)]/.test(block.rawText) || /dipnot|footnote/i.test(block.rawText)
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <p
        role={isFootnote ? 'note' : 'paragraph'}
        aria-label={isFootnote ? 'Dipnot' : undefined}
        className={cn(
          'text-ql-13 my-3 leading-7 select-text',
          isFootnote
            ? 'border-border/60 bg-muted/30 text-muted-foreground rounded-lg border px-3 py-2 text-[0.85rem] italic'
            : 'text-muted-foreground'
        )}
        id={isFootnote ? `footnote-${block.id}` : undefined}
      >
        {block.rawText}
      </p>
    </BlockWrapper>
  )
}

export function ListItemView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'list_item' }>
  documentId?: string
}) {
  const rich = parseInlineReferences(block.text)
  const hasRich = rich.length !== 1 || rich[0] !== block.text
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <p role="listitem" className="text-ql-14 my-1 ml-6 list-item list-disc leading-7 select-text">
        {hasRich ? rich : block.text}
      </p>
    </BlockWrapper>
  )
}

export function BlockRenderer({ block, documentId }: { block: QuizLabBlock; documentId?: string }) {
  switch (block.type) {
    case 'heading':
      return (
        <HeadingBlockView
          block={block as Extract<QuizLabBlock, { type: 'heading' }>}
          documentId={documentId}
        />
      )
    case 'paragraph':
      return (
        <ParagraphBlockView
          block={block as Extract<QuizLabBlock, { type: 'paragraph' }>}
          documentId={documentId}
        />
      )
    case 'list':
      return (
        <ListBlockView
          block={block as Extract<QuizLabBlock, { type: 'list' }>}
          documentId={documentId}
        />
      )
    case 'list_item':
      return (
        <ListItemView
          block={block as Extract<QuizLabBlock, { type: 'list_item' }>}
          documentId={documentId}
        />
      )
    case 'image':
      return (
        <ImageBlockView
          block={block as Extract<QuizLabBlock, { type: 'image' }>}
          documentId={documentId}
        />
      )
    case 'table':
      return (
        <TableBlockView
          block={block as Extract<QuizLabBlock, { type: 'table' }>}
          documentId={documentId}
        />
      )
    case 'caption':
      return (
        <CaptionView
          block={block as Extract<QuizLabBlock, { type: 'caption' }>}
          documentId={documentId}
        />
      )
    case 'code':
      return (
        <CodeBlockView
          block={block as Extract<QuizLabBlock, { type: 'code' }>}
          documentId={documentId}
        />
      )
    case 'formula':
      return (
        <FormulaBlockView
          block={block as Extract<QuizLabBlock, { type: 'formula' }>}
          documentId={documentId}
        />
      )
    case 'unknown':
      return (
        <UnknownBlockView
          block={block as Extract<QuizLabBlock, { type: 'unknown' }>}
          documentId={documentId}
        />
      )
    default:
      return (
        <BlockWrapper block={block} documentId={documentId}>
          <p className="text-ql-13 my-2 select-text">
            {(block as unknown as { text?: string }).text ?? ''}
          </p>
        </BlockWrapper>
      )
  }
}
