/* eslint-disable react/no-array-index-key -- table rows/cells use index as key, no stable id available from Docling */
import type { QuizLabBlock } from '@shared-core/types'

import { cn } from '@shared/lib/uiUtils'

import { ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAssetVisibility } from '../hooks/useAssetVisibility'
import { BlockWrapper } from './ReaderBlockShell'

function extractFigureNumber(caption: string | null | undefined): string | null {
  if (!caption) return null
  const m = caption.match(/(?:Şekil|Figure|Fig\.?)\s*(\d+)/i)
  return m ? m[1]! : null
}
function extractTableNumber(caption: string | null | undefined): string | null {
  if (!caption) return null
  const m = caption.match(/(?:Tablo|Table)\s*(\d+)/i)
  return m ? m[1]! : null
}

export function ImageBlockView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'image' }>
  documentId?: string
}) {
  const src = block.assetUrl
  const [failed, setFailed] = useState(false)
  const { ref: visibilityRef, shouldLoad, isVisible } = useAssetVisibility('800px')
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src ?? null)
  const figureNumber = extractFigureNumber(block.caption)

  // Memory recycling: when far from viewport, drop src to free decode memory
  // Object URL'ler IntersectionObserver ile geri dönüştürülür (lazy load / memory recycling)
  useEffect(() => {
    if (!src) {
      setResolvedSrc(null)
      return
    }
    if (shouldLoad && isVisible) {
      setResolvedSrc(src)
    } else if (!shouldLoad && !isVisible) {
      // Unload after delay handled inside hook; now clear to release memory
      setResolvedSrc(null)
    }
  }, [src, shouldLoad, isVisible])

  // Revoke blob/object URLs when unloading (if any)
  useEffect(() => {
    return () => {
      if (resolvedSrc && resolvedSrc.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(resolvedSrc)
        } catch {}
      }
    }
  }, [resolvedSrc])

  const showImg = !!resolvedSrc && !failed && shouldLoad
  const showPlaceholder = !showImg
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <figure
        ref={visibilityRef as React.RefObject<HTMLElement>}
        id={figureNumber ? `figure-${figureNumber}` : undefined}
        data-figure-number={figureNumber ?? undefined}
        data-block-id={block.id}
        role="figure"
        aria-label={block.caption ?? block.alt ?? `Şekil ${figureNumber ?? ''}`}
        className="border-border/60 bg-card/60 supports-[backdrop-filter]:bg-card/40 my-6 overflow-hidden rounded-2xl border shadow-sm backdrop-blur"
      >
        {showImg ? (
          <div className="bg-muted/20 flex justify-center p-2">
            <img
              src={resolvedSrc!}
              alt={block.alt ?? block.caption ?? 'Görsel'}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
              className="h-auto max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow"
              style={{ aspectRatio: 'auto' } as React.CSSProperties}
            />
          </div>
        ) : showPlaceholder ? (
          <div className="from-muted/60 to-muted/20 border-border/40 flex flex-col items-center justify-center gap-2 border-b bg-gradient-to-b px-6 py-10">
            <div className="bg-muted text-muted-foreground/60 rounded-full p-3">
              <ImageIcon className="h-6 w-6" />
            </div>
            <span className="text-muted-foreground text-ql-13">
              {shouldLoad
                ? 'Görsel yüklenemedi'
                : 'Görsel beklemede (viewport dışı – bellekten düşürüldü)'}
            </span>
            {src && (
              <span className="text-muted-foreground/60 text-ql-11 max-w-full truncate font-mono">
                {src.slice(0, 48)}…
              </span>
            )}
            {!shouldLoad && src && (
              <span className="text-muted-foreground/40 text-ql-11">
                Kaydırınca yeniden yüklenecek
              </span>
            )}
          </div>
        ) : null}
        {block.caption && (
          <figcaption className="text-muted-foreground bg-muted/30 text-ql-12 border-border/40 border-t px-4 py-2.5 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    </BlockWrapper>
  )
}

export function TableBlockView({
  block,
  documentId
}: {
  block: Extract<QuizLabBlock, { type: 'table' }>
  documentId?: string
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const tableNumber = extractTableNumber(block.caption)
  const toCsv = (): string =>
    block.rows
      .map((r) => r.map((c) => `"${(c.text ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n')
  const toMarkdown = (): string => {
    if (block.rows.length === 0) return ''
    const header = `| ${block.rows[0].map((c) => c.text || ' ').join(' | ')} |`
    const sep = `| ${block.rows[0].map(() => '---').join(' | ')} |`
    const body = block.rows.slice(1).map((r) => `| ${r.map((c) => c.text || ' ').join(' | ')} |`)
    return [header, sep, ...body].join('\n')
  }
  const copy = async (text: string, kind: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }
  return (
    <BlockWrapper block={block} documentId={documentId}>
      <figure
        id={tableNumber ? `table-${tableNumber}` : undefined}
        data-table-number={tableNumber ?? undefined}
        data-block-id={block.id}
        role="figure"
        aria-label={block.caption ?? `Tablo ${tableNumber ?? ''}`}
        className="border-border/60 my-6 overflow-hidden rounded-2xl border shadow-sm"
      >
        <div className="border-border/30 bg-muted/20 flex items-center justify-end gap-1 border-b px-2 py-1">
          <button
            type="button"
            onClick={() => void copy(toCsv(), 'csv')}
            className="text-ql-11 border-border bg-card hover:bg-muted rounded-md border px-2 py-1"
            title="CSV olarak kopyala"
          >
            {copied === 'csv' ? 'Kopyalandı ✓' : 'CSV'}
          </button>
          <button
            type="button"
            onClick={() => void copy(toMarkdown(), 'md')}
            className="text-ql-11 border-border bg-card hover:bg-muted rounded-md border px-2 py-1"
            title="Markdown olarak kopyala"
          >
            {copied === 'md' ? 'Kopyalandı ✓' : 'Markdown'}
          </button>
        </div>
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table
            role="table"
            aria-label={block.caption ?? `Tablo ${tableNumber ?? ''}`}
            aria-rowcount={block.rows.length}
            className="text-ql-13 w-full min-w-[420px] border-collapse select-text"
          >
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={ri}
                  role="row"
                  aria-rowindex={ri + 1}
                  className={cn(
                    ri === 0 ? 'bg-muted/60' : ri % 2 === 0 ? 'bg-muted/15' : 'bg-card'
                  )}
                >
                  {row.map((cell, ci) => {
                    const CellTag = cell.isHeader || ri === 0 ? 'th' : 'td'
                    return (
                      <CellTag
                        key={ci}
                        role={cell.isHeader || ri === 0 ? 'columnheader' : 'cell'}
                        colSpan={cell.colSpan}
                        rowSpan={cell.rowSpan}
                        onClick={(e) => {
                          const sel = window.getSelection()
                          const range = document.createRange()
                          range.selectNodeContents(e.currentTarget)
                          sel?.removeAllRanges()
                          sel?.addRange(range)
                        }}
                        className={cn(
                          'border-border/60 hover:bg-primary/5 cursor-text border px-3.5 py-2.5 text-left align-top leading-6 transition-colors',
                          cell.isHeader && 'bg-muted/80 font-semibold'
                        )}
                        title="Hücreyi seçmek için tıkla"
                      >
                        {cell.text}
                      </CellTag>
                    )
                  })}
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
