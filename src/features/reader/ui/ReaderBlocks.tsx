/* eslint-disable react/no-array-index-key -- table rows/cells use index as key, no stable id available from Docling */
import type { QuizLabBlock } from '@shared-core/types'

import { useShowInPdf } from '@features/reader/hooks/useReaderPdfLink'

import { cn } from '@shared/lib/uiUtils'

import { ImageIcon } from 'lucide-react'
import { memo, useState } from 'react'

function PageBadge({ pageNumber }: { pageNumber: number }) {
  return (
    <span
      className="text-ql-11 text-muted-foreground/70 border-border/60 bg-muted/30 inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono backdrop-blur"
      title={`Sayfa ${pageNumber}`}
      aria-label={`Sayfa ${pageNumber}`}
    >
      {pageNumber}
    </span>
  )
}

export const BlockWrapper = memo(function BlockWrapper({
  block,
  children
}: {
  block: QuizLabBlock
  children: React.ReactNode
}) {
  const showInPdf = useShowInPdf()
  return (
    <div
      data-block-id={block.id}
      data-page={block.pageNumber}
      className="group/block scroll-mt-4"
      style={{ contentVisibility: 'auto' as never, containIntrinsicSize: '0 600px' } as never}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex items-center gap-1.5">
          <PageBadge pageNumber={block.pageNumber} />
          <button
            type="button"
            onClick={() => showInPdf(block)}
            className="border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 text-ql-11 hidden items-center gap-1 rounded-full border px-2 py-0.5 group-hover/block:inline-flex"
            aria-label={`PDF'de göster, sayfa ${block.pageNumber}`}
            title="PDF'de göster"
          >
            PDF’de Göster
          </button>
        </div>
      </div>
    </div>
  )
})

export function HeadingBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'heading' }> }) {
  const Tag = `h${Math.min(6, Math.max(1, block.level))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  const level1 = block.level === 1
  return (
    <BlockWrapper block={block}>
      <Tag
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
  block
}: {
  block: Extract<QuizLabBlock, { type: 'paragraph' }>
}) {
  return (
    <BlockWrapper block={block}>
      <p className="text-foreground/90 text-ql-14 my-3 leading-7 select-text">{block.text}</p>
    </BlockWrapper>
  )
}

export function ListBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'list' }> }) {
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <BlockWrapper block={block}>
      <Tag
        className={cn(
          'my-3 list-outside space-y-1 pl-6',
          block.ordered ? 'list-decimal' : 'list-disc'
        )}
      >
        {block.items.map((item, i) => (
          <li key={i} className="text-ql-14 leading-7 select-text">
            {item}
          </li>
        ))}
      </Tag>
    </BlockWrapper>
  )
}

export function ImageBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'image' }> }) {
  const src = block.assetUrl
  const [failed, setFailed] = useState(false)
  const showImg = !!src && !failed
  return (
    <BlockWrapper block={block}>
      <figure className="border-border/60 bg-card/60 supports-[backdrop-filter]:bg-card/40 my-6 overflow-hidden rounded-2xl border shadow-sm backdrop-blur">
        {showImg ? (
          <div className="bg-muted/20 flex justify-center p-2">
            <img
              src={src}
              alt={block.alt ?? block.caption ?? 'Görsel'}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
              className="h-auto max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow"
              style={{ aspectRatio: 'auto' }}
            />
          </div>
        ) : (
          <div className="from-muted/60 to-muted/20 border-border/40 flex flex-col items-center justify-center gap-2 border-b bg-gradient-to-b px-6 py-10">
            <div className="bg-muted text-muted-foreground/60 rounded-full p-3">
              <ImageIcon className="h-6 w-6" />
            </div>
            <span className="text-muted-foreground text-ql-13">Görsel yüklenemedi</span>
            {src && (
              <span className="text-muted-foreground/60 text-ql-11 max-w-full truncate font-mono">
                {src.slice(0, 48)}…
              </span>
            )}
          </div>
        )}
        {block.caption && (
          <figcaption className="text-muted-foreground bg-muted/30 text-ql-12 border-border/40 border-t px-4 py-2.5 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    </BlockWrapper>
  )
}

export function TableBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'table' }> }) {
  return (
    <BlockWrapper block={block}>
      <figure className="border-border/60 my-6 overflow-hidden rounded-2xl border shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="text-ql-13 w-full min-w-[420px] border-collapse">
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn(
                    ri === 0 ? 'bg-muted/60' : ri % 2 === 0 ? 'bg-muted/15' : 'bg-card'
                  )}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      className={cn(
                        'border-border/60 border px-3.5 py-2.5 text-left align-top leading-6',
                        cell.isHeader && 'bg-muted/80 font-semibold'
                      )}
                    >
                      {cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {block.caption && (
          <figcaption className="text-muted-foreground bg-muted/30 text-ql-12 border-border/40 border-t px-4 py-2.5 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    </BlockWrapper>
  )
}

export function CodeBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'code' }> }) {
  return (
    <BlockWrapper block={block}>
      <pre className="bg-muted border-border text-ql-13 my-4 overflow-x-auto rounded-xl border p-4 font-mono leading-6">
        <code>{block.text}</code>
      </pre>
    </BlockWrapper>
  )
}

export function FormulaBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'formula' }> }) {
  return (
    <BlockWrapper block={block}>
      <div className="bg-muted/40 border-border text-ql-13 my-4 rounded-xl border p-4 font-mono">
        {block.latex ?? block.text}
      </div>
    </BlockWrapper>
  )
}

export function CaptionView({ block }: { block: Extract<QuizLabBlock, { type: 'caption' }> }) {
  return (
    <BlockWrapper block={block}>
      <p className="text-muted-foreground text-ql-12 my-2 italic select-text">{block.text}</p>
    </BlockWrapper>
  )
}

export function UnknownBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'unknown' }> }) {
  if (!block.rawText) return null
  return (
    <BlockWrapper block={block}>
      <p className="text-muted-foreground text-ql-13 my-3 leading-7 select-text">{block.rawText}</p>
    </BlockWrapper>
  )
}

export function ListItemView({ block }: { block: Extract<QuizLabBlock, { type: 'list_item' }> }) {
  return (
    <BlockWrapper block={block}>
      <p className="text-ql-14 my-1 ml-6 list-item list-disc leading-7 select-text">{block.text}</p>
    </BlockWrapper>
  )
}

export function BlockRenderer({ block }: { block: QuizLabBlock }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlockView block={block as Extract<QuizLabBlock, { type: 'heading' }>} />
    case 'paragraph':
      return <ParagraphBlockView block={block as Extract<QuizLabBlock, { type: 'paragraph' }>} />
    case 'list':
      return <ListBlockView block={block as Extract<QuizLabBlock, { type: 'list' }>} />
    case 'list_item':
      return <ListItemView block={block as Extract<QuizLabBlock, { type: 'list_item' }>} />
    case 'image':
      return <ImageBlockView block={block as Extract<QuizLabBlock, { type: 'image' }>} />
    case 'table':
      return <TableBlockView block={block as Extract<QuizLabBlock, { type: 'table' }>} />
    case 'caption':
      return <CaptionView block={block as Extract<QuizLabBlock, { type: 'caption' }>} />
    case 'code':
      return <CodeBlockView block={block as Extract<QuizLabBlock, { type: 'code' }>} />
    case 'formula':
      return <FormulaBlockView block={block as Extract<QuizLabBlock, { type: 'formula' }>} />
    case 'unknown':
      return <UnknownBlockView block={block as Extract<QuizLabBlock, { type: 'unknown' }>} />
    default:
      return (
        <BlockWrapper block={block}>
          <p className="text-ql-13 my-2 select-text">
            {(block as unknown as { text?: string }).text ?? ''}
          </p>
        </BlockWrapper>
      )
  }
}
