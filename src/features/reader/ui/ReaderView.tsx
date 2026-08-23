/* eslint-disable react/no-array-index-key -- table rows/cells use index as key, no stable id available from Docling */
import type { QuizLabBlock, QuizLabDocument } from '@shared-core/types'

import { useShowInPdf } from '@features/reader/hooks/useReaderPdfLink'

import { cn } from '@shared/lib/uiUtils'

import { memo } from 'react'

function PageBadge({ pageNumber }: { pageNumber: number }) {
  return (
    <span
      className="text-ql-11 text-muted-foreground border-border bg-muted/40 inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono"
      title={`Sayfa ${pageNumber}`}
      aria-label={`Sayfa ${pageNumber}`}
    >
      {pageNumber}
    </span>
  )
}

const BlockWrapper = memo(function BlockWrapper({
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

function HeadingBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'heading' }> }) {
  const Tag = `h${Math.min(6, Math.max(1, block.level))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  return (
    <BlockWrapper block={block}>
      <Tag className="text-foreground text-ql-15 mt-6 mb-2 font-semibold tracking-tight first:mt-0 data-[level='1']:text-[1.3rem] data-[level='2']:text-[1.15rem]">
        {block.text}
      </Tag>
    </BlockWrapper>
  )
}

function ParagraphBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'paragraph' }> }) {
  return (
    <BlockWrapper block={block}>
      <p className="text-foreground/90 text-ql-14 my-3 leading-7 select-text">{block.text}</p>
    </BlockWrapper>
  )
}

function ListBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'list' }> }) {
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

function ImageBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'image' }> }) {
  const src = block.assetUrl
  return (
    <BlockWrapper block={block}>
      <figure className="border-border bg-card my-6 overflow-hidden rounded-xl border">
        {src ? (
          <img
            src={src}
            alt={block.alt ?? block.caption ?? 'Görsel'}
            loading="lazy"
            decoding="async"
            className="h-auto max-h-[70vh] w-full object-contain"
            style={{ aspectRatio: 'auto' }}
          />
        ) : (
          <div className="bg-muted text-muted-foreground text-ql-13 flex h-32 items-center justify-center">
            Görsel yüklenemedi
          </div>
        )}
        {block.caption && (
          <figcaption className="text-muted-foreground bg-muted/40 text-ql-12 px-3 py-2 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    </BlockWrapper>
  )
}

function TableBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'table' }> }) {
  return (
    <BlockWrapper block={block}>
      <figure className="border-border my-6 overflow-hidden rounded-xl border">
        <div className="max-w-full overflow-x-auto">
          <table className="text-ql-13 w-full min-w-[400px] border-collapse">
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? 'bg-muted/50' : ''}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      className={cn(
                        'border-border border px-3 py-2 text-left align-top',
                        cell.isHeader && 'bg-muted font-semibold'
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
          <figcaption className="text-muted-foreground bg-muted/40 text-ql-12 px-3 py-2 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    </BlockWrapper>
  )
}

function CodeBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'code' }> }) {
  return (
    <BlockWrapper block={block}>
      <pre className="bg-muted border-border text-ql-13 my-4 overflow-x-auto rounded-xl border p-4 font-mono leading-6">
        <code>{block.text}</code>
      </pre>
    </BlockWrapper>
  )
}

function FormulaBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'formula' }> }) {
  return (
    <BlockWrapper block={block}>
      <div className="bg-muted/40 border-border text-ql-13 my-4 rounded-xl border p-4 font-mono">
        {block.latex ?? block.text}
      </div>
    </BlockWrapper>
  )
}

function CaptionView({ block }: { block: Extract<QuizLabBlock, { type: 'caption' }> }) {
  return (
    <BlockWrapper block={block}>
      <p className="text-muted-foreground text-ql-12 my-2 italic select-text">{block.text}</p>
    </BlockWrapper>
  )
}

function UnknownBlockView({ block }: { block: Extract<QuizLabBlock, { type: 'unknown' }> }) {
  if (!block.rawText) return null
  return (
    <BlockWrapper block={block}>
      <p className="text-muted-foreground text-ql-13 my-3 leading-7 select-text">{block.rawText}</p>
    </BlockWrapper>
  )
}

function ListItemView({ block }: { block: Extract<QuizLabBlock, { type: 'list_item' }> }) {
  return (
    <BlockWrapper block={block}>
      <p className="text-ql-14 my-1 ml-6 list-item list-disc leading-7 select-text">{block.text}</p>
    </BlockWrapper>
  )
}

function BlockRenderer({ block }: { block: QuizLabBlock }) {
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

interface Props {
  document: QuizLabDocument
  onReprocess?: () => void
}

const ReaderView = memo(function ReaderView({ document, onReprocess }: Props) {
  return (
    <article
      className="mx-auto max-w-3xl px-6 py-8 select-text"
      aria-label={document.title ?? 'Akıllı okuma'}
    >
      {document.title && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="text-foreground text-xl font-bold tracking-tight">{document.title}</h1>
          {onReprocess && (
            <button
              type="button"
              onClick={onReprocess}
              className="text-ql-11 border-border bg-card text-muted-foreground hover:text-foreground shrink-0 rounded-full border px-2.5 py-1"
              aria-label="Belgeyi yeniden işle"
            >
              Yeniden işle
            </button>
          )}
        </div>
      )}
      {!document.title && onReprocess && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onReprocess}
            className="text-ql-11 border-border bg-card text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-1"
          >
            Yeniden işle
          </button>
        </div>
      )}
      <div className="space-y-1">
        {document.blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} />
        ))}
      </div>
      {document.blocks.length === 0 && (
        <p className="text-muted-foreground text-ql-13 py-12 text-center">İçerik bulunamadı</p>
      )}
    </article>
  )
})

export default ReaderView
